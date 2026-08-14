"use server";

import { revalidatePath } from "next/cache";
import { VaccineStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBookingSchema } from "@/lib/validations";
import { calculateStayPricing, serializeMoney } from "@/lib/pricing";
import { createPixDeposit, resolveMercadoPagoToken } from "@/lib/mercadopago";
import { requireStaffSession } from "@/lib/auth";
import { assertOwnedBooking } from "@/lib/tenant";
import { sendWhatsAppText, whatsappTemplates } from "@/lib/whatsapp";
import { toDateKey } from "@/lib/schedule";
import { assertSlotAvailable } from "@/lib/tenant-schedule";

export type CreateBookingInput = {
  tenantSlug: string;
  serviceId: string;
  startDate: string;
  endDate: string;
  slotTime?: string;
  tutor: {
    name: string;
    phone: string;
    cpf?: string;
    address?: string;
    email?: string;
  };
  pet: {
    name: string;
    species: "DOG" | "CAT" | "OTHER";
    breed?: string;
    size: "SMALL" | "MEDIUM" | "LARGE";
    birthDate?: string;
    notes?: string;
  };
  vaccines?: Array<{
    name: string;
  }>;
};

export async function createBooking(input: CreateBookingInput) {
  const parsed = createBookingSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const, error: "Dados da reserva incompletos." };
  }

  const data = parsed.data;

  if (data.endDate < data.startDate) {
    return {
      ok: false as const,
      error: "A data de saída deve ser igual ou posterior à de entrada.",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (data.startDate < today) {
    return { ok: false as const, error: "Escolha uma data a partir de hoje." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: data.tenantSlug },
  });

  if (!tenant || tenant.status === "SUSPENDED") {
    return { ok: false as const, error: "Estabelecimento indisponível." };
  }

  const service = await prisma.tenantService.findFirst({
    where: {
      id: data.serviceId,
      tenantId: tenant.id,
      active: true,
    },
  });

  if (!service) {
    return { ok: false as const, error: "Esse serviço não está disponível." };
  }

  const isAppointment = service.kind === "APPOINTMENT";
  const startDate = isAppointment
    ? new Date(`${toDateKey(data.startDate)}T12:00:00`)
    : data.startDate;
  const endDate = isAppointment ? startDate : data.endDate;
  const slotTime = isAppointment ? data.slotTime : undefined;

  if (isAppointment && !slotTime) {
    return { ok: false as const, error: "Escolha um horário disponível." };
  }

  const slotCheck = await assertSlotAvailable({
    tenantId: tenant.id,
    kind: service.kind,
    startDate,
    endDate,
    slotTime,
  });
  if (!slotCheck.ok) {
    return slotCheck;
  }

  const pricing = calculateStayPricing(
    Number(service.price),
    startDate,
    endDate,
    Number(tenant.depositRate),
  );

  const requiredVaccines = await prisma.tenantRequiredVaccine.findMany({
    where: { tenantId: tenant.id },
    select: { name: true },
  });
  const recordedNames = data.vaccines.map((vaccine) => vaccine.name);
  const missingVaccines = requiredVaccines
    .map((vaccine) => vaccine.name)
    .filter((name) => !recordedNames.includes(name));

  const booking = await prisma.$transaction(async (tx) => {
    const tutor = await tx.tutor.upsert({
      where: {
        tenantId_phone: {
          tenantId: tenant.id,
          phone: data.tutor.phone,
        },
      },
      update: {
        name: data.tutor.name,
        cpf: data.tutor.cpf,
        address: data.tutor.address,
      },
      create: {
        tenantId: tenant.id,
        name: data.tutor.name,
        phone: data.tutor.phone,
        cpf: data.tutor.cpf,
        address: data.tutor.address,
      },
    });

    const pet = await tx.pet.create({
      data: {
        tenantId: tenant.id,
        tutorId: tutor.id,
        name: data.pet.name,
        species: data.pet.species,
        breed: data.pet.breed,
        size: data.pet.size,
        birthDate: data.pet.birthDate,
        notes: data.pet.notes,
      },
    });

    if (data.vaccines.length > 0) {
      await tx.vaccine.createMany({
        data: data.vaccines.map((vaccine) => ({
          tenantId: tenant.id,
          petId: pet.id,
          name: vaccine.name,
          status: VaccineStatus.VALID,
        })),
      });
    }

    return tx.booking.create({
      data: {
        tenantId: tenant.id,
        petId: pet.id,
        serviceId: service.id,
        serviceType: service.name,
        startDate,
        endDate,
        slotTime: slotTime ?? null,
        status: "PENDING",
        paymentStatus: "PENDING",
        totalAmount: pricing.totalAmount,
        depositAmount: pricing.depositAmount,
      },
      include: {
        pet: { include: { tutor: true } },
      },
    });
  });

  const accessToken = resolveMercadoPagoToken(tenant);
  let pix: {
    paymentId: string;
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl?: string;
  } | null = null;

  if (accessToken) {
    try {
      pix = await createPixDeposit({
        accessToken,
        bookingId: booking.id,
        amount: pricing.depositAmount,
        description: `Sinal PetFlow · ${service.name} · ${booking.pet.name}`,
        payerEmail: data.tutor.email ?? `tutor-${booking.pet.tutor.id}@petflow.app`,
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { mpPaymentId: pix.paymentId },
      });
    } catch (error) {
      console.error("[createBooking] pix", error);
      pix = null;
    }
  }

  return {
    ok: true as const,
    bookingId: booking.id,
    missingVaccines,
    totals: {
      nights: pricing.nights,
      totalAmount: pricing.totalAmount,
      depositAmount: pricing.depositAmount,
    },
    pix,
  };
}

export async function confirmPaidBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      pet: { include: { tutor: true } },
      tenant: true,
    },
  });

  if (!booking) {
    return { ok: false as const, error: "Reserva não encontrada." };
  }

  if (booking.paymentStatus === "PAID" && booking.status !== "PENDING") {
    return { ok: true as const };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { paymentStatus: "PAID", status: "CONFIRMED" },
  });

  const instanceName =
    booking.tenant.whatsappInstanceName ?? `petflow_${booking.tenant.slug}`;

  try {
    await sendWhatsAppText({
      instanceName,
      phone: booking.pet.tutor.phone,
      text: whatsappTemplates.confirmation({
        tutorName: booking.pet.tutor.name,
        petName: booking.pet.name,
        startDate: booking.startDate,
        endDate: booking.endDate,
        slotTime: booking.slotTime,
      }),
    });
  } catch (error) {
    console.error("[confirm-booking] whatsapp", error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/check-in");
  return { ok: true as const };
}

export async function markBookingPaid(bookingId: string) {
  const { tenantId } = await requireStaffSession();
  await assertOwnedBooking(tenantId, bookingId);
  return confirmPaidBooking(bookingId);
}

export async function getPendingBookings() {
  const { tenantId } = await requireStaffSession();
  const bookings = await prisma.booking.findMany({
    where: { tenantId, status: "PENDING" },
    include: { pet: { include: { tutor: true } } },
    orderBy: { createdAt: "desc" },
  });

  return bookings.map((booking) => ({
    id: booking.id,
    petName: booking.pet.name,
    tutorName: booking.pet.tutor.name,
    tutorPhone: booking.pet.tutor.phone,
    serviceType: booking.serviceType,
    startDate: booking.startDate,
    endDate: booking.endDate,
    slotTime: booking.slotTime,
    depositAmount: serializeMoney(booking.depositAmount),
    paymentStatus: booking.paymentStatus,
  }));
}

export async function getBookingPaymentStatus(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
    },
  });

  if (!booking) {
    return { ok: false as const, error: "Reserva não encontrada." };
  }

  return {
    ok: true as const,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    confirmed: booking.status === "CONFIRMED" && booking.paymentStatus === "PAID",
  };
}

export async function checkInBooking(input: {
  bookingId: string;
  items: Array<{ itemName: string; quantity: number }>;
  vaccineNames?: string[];
}) {
  const { tenantId } = await requireStaffSession();
  const booking = await assertOwnedBooking(tenantId, input.bookingId);

  if (booking.status !== "CONFIRMED") {
    return {
      ok: false as const,
      error: "Só é possível fazer check-in de reservas confirmadas.",
    };
  }

  const requiredVaccines = await prisma.tenantRequiredVaccine.findMany({
    where: { tenantId },
    select: { name: true },
  });
  const vaccineNames = (input.vaccineNames ?? []).map((name) => name.trim()).filter(Boolean);
  const missingVaccines = requiredVaccines
    .map((vaccine) => vaccine.name)
    .filter((name) => !vaccineNames.includes(name));

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CHECKED_IN" },
    });

    if (input.items.length > 0) {
      await tx.checklistItem.createMany({
        data: input.items
          .filter((item) => item.itemName.trim().length > 0)
          .map((item) => ({
            tenantId,
            bookingId: booking.id,
            itemName: item.itemName.trim(),
            quantity: item.quantity || 1,
          })),
      });
    }

    const existing = new Set(booking.pet.vaccines.map((vaccine) => vaccine.name));
    const toCreate = vaccineNames.filter((name) => !existing.has(name));
    if (toCreate.length > 0) {
      await tx.vaccine.createMany({
        data: toCreate.map((name) => ({
          tenantId,
          petId: booking.pet.id,
          name,
          status: VaccineStatus.VALID,
        })),
      });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/check-in");
  revalidatePath("/dashboard/daily-logs");

  return {
    ok: true as const,
    missingVaccines,
  };
}

export async function checkOutBooking(bookingId: string) {
  const { tenantId } = await requireStaffSession();
  const booking = await assertOwnedBooking(tenantId, bookingId);

  if (booking.status !== "CHECKED_IN") {
    return {
      ok: false as const,
      error: "Só é possível fazer check-out de pets hospedados.",
    };
  }

  await prisma.$transaction([
    prisma.checklistItem.updateMany({
      where: { bookingId, tenantId },
      data: { returnedOnCheckout: true },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CHECKED_OUT" },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/check-in");
  revalidatePath("/dashboard/daily-logs");

  return { ok: true as const };
}

export async function getTodayOccupation() {
  const { tenantId } = await requireStaffSession();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [checkIns, checkOuts, inHouse] = await Promise.all([
    prisma.booking.findMany({
      where: {
        tenantId,
        startDate: { gte: start, lte: end },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
      include: { pet: { include: { tutor: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        tenantId,
        endDate: { gte: start, lte: end },
        status: { in: ["CHECKED_IN", "CONFIRMED"] },
      },
      include: { pet: { include: { tutor: true } } },
      orderBy: { endDate: "asc" },
    }),
    prisma.booking.findMany({
      where: { tenantId, status: "CHECKED_IN" },
      include: { pet: { include: { tutor: true } } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return {
    checkIns: checkIns.map(serializeStay),
    checkOuts: checkOuts.map(serializeStay),
    inHouse: inHouse.map(serializeStay),
  };
}

function serializeStay(booking: {
  id: string;
  serviceType: string;
  startDate: Date;
  endDate: Date;
  slotTime?: string | null;
  status: string;
  totalAmount: { toString(): string } | number;
  pet: {
    name: string;
    species: string;
    tutor: { name: string; phone: string };
  };
}) {
  return {
    id: booking.id,
    serviceType: booking.serviceType,
    startDate: booking.startDate,
    endDate: booking.endDate,
    slotTime: booking.slotTime,
    status: booking.status,
    totalAmount: serializeMoney(booking.totalAmount),
    petName: booking.pet.name,
    species: booking.pet.species,
    tutorName: booking.pet.tutor.name,
    tutorPhone: booking.pet.tutor.phone,
  };
}
