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
import { eachDateKey, effectiveServiceKind, toDateKey } from "@/lib/schedule";
import { petPolicyFromTenant, hasPetCareProfile, sizesForSpecies } from "@/lib/constants";
import { assertSlotAvailable } from "@/lib/tenant-schedule";
import { cpfDigits, phoneDigits, pixPayerEmail } from "@/lib/utils";

export type CreateBookingInput = {
  tenantSlug: string;
  serviceId: string;
  startDate: string;
  endDate: string;
  slotTime?: string;
  checkoutTime?: string;
  tutor: {
    name: string;
    phone: string;
    cpf?: string;
    address?: string;
    pix?: {
      kind: "CPF" | "EMAIL" | "PHONE";
      key: string;
    };
  };
  pet: {
    name: string;
    species: "DOG" | "CAT" | "OTHER";
    breed?: string;
    size: "SMALL" | "MEDIUM" | "LARGE";
    birthDate?: string;
    notes?: string;
    castrated?: boolean;
    vaccinated?: boolean;
    aggressive?: boolean;
  };
  vaccines?: Array<{
    name: string;
  }>;
};

function resolvePixPayer(pix?: { kind: "CPF" | "EMAIL" | "PHONE"; key: string }) {
  if (!pix?.key.trim()) return null;

  if (pix.kind === "EMAIL") {
    const email = pix.key.trim().toLowerCase();
    if (!email.includes("@") || email.length < 5) {
      return { ok: false as const, error: "Informe um e-mail PIX válido." };
    }
    return { ok: true as const, email, cpf: undefined };
  }

  if (pix.kind === "CPF") {
    const digits = cpfDigits(pix.key);
    if (digits.length !== 11) {
      return { ok: false as const, error: "Informe um CPF PIX válido." };
    }
    return { ok: true as const, email: pixPayerEmail("CPF", digits), cpf: digits };
  }

  const digits = phoneDigits(pix.key);
  if (digits.length < 10) {
    return { ok: false as const, error: "Informe um celular PIX válido." };
  }
  return { ok: true as const, email: pixPayerEmail("PHONE", digits), cpf: undefined };
}

async function sendBookingConfirmedWhatsApp(input: {
  tenant: { slug: string; whatsappInstanceName: string | null };
  tutorName: string;
  tutorPhone: string;
  petName: string;
  startDate: Date;
  endDate: Date;
  slotTime?: string | null;
}) {
  const instanceName =
    input.tenant.whatsappInstanceName ?? `petflow_${input.tenant.slug}`;
  try {
    await sendWhatsAppText({
      instanceName,
      phone: input.tutorPhone,
      text: whatsappTemplates.confirmation({
        tutorName: input.tutorName,
        petName: input.petName,
        startDate: input.startDate,
        endDate: input.endDate,
        slotTime: input.slotTime,
      }),
    });
  } catch (error) {
    console.error("[confirm-booking] whatsapp", error);
  }
}

export async function createBooking(input: CreateBookingInput) {
  try {
    return await runCreateBooking(input);
  } catch (error) {
    console.error("[createBooking]", error);
    return {
      ok: false as const,
      error: "Não foi possível enviar a reserva. Tente de novo.",
    };
  }
}

async function runCreateBooking(input: CreateBookingInput) {
  const parsed = createBookingSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const, error: "Dados da reserva incompletos." };
  }

  const data = parsed.data;

  if (hasPetCareProfile(data.pet.species)) {
    if (
      data.pet.castrated === undefined ||
      data.pet.vaccinated === undefined ||
      data.pet.aggressive === undefined
    ) {
      return {
        ok: false as const,
        error: "Informe se o pet é castrado, se tomou vacina e se é agressivo.",
      };
    }
  }

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

  const accessToken = resolveMercadoPagoToken(tenant);
  const pixPayer = resolvePixPayer(data.tutor.pix);

  const policy = petPolicyFromTenant(tenant);
  if (data.pet.species === "CAT" && policy.catSizes.length === 0) {
    return { ok: false as const, error: "Este hotel não atende gatos." };
  }
  if (data.pet.species !== "CAT" && policy.dogSizes.length === 0) {
    return { ok: false as const, error: "Este hotel não atende cães." };
  }
  const petSize = data.pet.size;
  if (!sizesForSpecies(data.pet.species, policy).includes(petSize)) {
    return { ok: false as const, error: "Este hotel não atende esse porte." };
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

  const kind = effectiveServiceKind(service.kind, service.name);
  const isAppointment = kind === "APPOINTMENT";
  const isHotel = kind === "STAY";
  const startDate = isAppointment
    ? new Date(`${toDateKey(data.startDate)}T12:00:00`)
    : data.startDate;
  const endDate = isAppointment ? startDate : data.endDate;
  const slotTime = isAppointment ? data.slotTime : undefined;
  const checkoutTime = isHotel ? data.checkoutTime : undefined;

  if (isAppointment && !slotTime) {
    return { ok: false as const, error: "Escolha um horário disponível." };
  }

  const slotCheck = await assertSlotAvailable({
    tenantId: tenant.id,
    serviceId: service.id,
    kind,
    startDate,
    endDate,
    slotTime,
    checkoutTime,
    species: data.pet.species,
  });
  if (!slotCheck.ok) {
    return slotCheck;
  }

  const daycareDays =
    kind === "DAYCARE" ? eachDateKey(startDate, endDate).length : undefined;

  const pricing = calculateStayPricing(
    Number(service.price),
    startDate,
    endDate,
    {
      checkoutTime,
      cutoffTime: service.dailyCutoffTime,
      depositAmount: service.depositAmount == null ? null : Number(service.depositAmount),
      days: isAppointment ? 1 : daycareDays,
    },
  );
  const requiresEntrada = pricing.depositAmount > 0;

  if (requiresEntrada && accessToken) {
    if (!pixPayer) {
      return {
        ok: false as const,
        error: "Informe a chave PIX: CPF, e-mail ou celular.",
      };
    }
    if (!pixPayer.ok) return pixPayer;
  }

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
        size: petSize,
        birthDate: data.pet.birthDate,
        notes: data.pet.notes,
        castrated: hasPetCareProfile(data.pet.species) ? data.pet.castrated ?? null : null,
        vaccinated: hasPetCareProfile(data.pet.species) ? data.pet.vaccinated ?? null : null,
        aggressive: hasPetCareProfile(data.pet.species) ? data.pet.aggressive ?? null : null,
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
        checkoutTime: checkoutTime ?? null,
        status: requiresEntrada ? "PENDING" : "CONFIRMED",
        paymentStatus: requiresEntrada ? "PENDING" : "PAID",
        totalAmount: pricing.totalAmount,
        depositAmount: pricing.depositAmount,
      },
      include: {
        pet: { include: { tutor: true } },
      },
    });
  });

  let pix: {
    paymentId: string;
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl?: string;
  } | null = null;

  if (requiresEntrada && accessToken) {
    try {
      pix = await createPixDeposit({
        accessToken,
        bookingId: booking.id,
        amount: pricing.depositAmount,
        description: `Entrada PetFlow · ${service.name} · ${booking.pet.name}`,
        payerEmail:
          pixPayer && pixPayer.ok
            ? pixPayer.email
            : `tutor-${booking.pet.tutor.id}@petflow.app`,
        payerCpf: pixPayer && pixPayer.ok ? pixPayer.cpf : undefined,
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

  if (!requiresEntrada) {
    void sendBookingConfirmedWhatsApp({
      tenant,
      tutorName: booking.pet.tutor.name,
      tutorPhone: booking.pet.tutor.phone,
      petName: booking.pet.name,
      startDate: booking.startDate,
      endDate: booking.endDate,
      slotTime: booking.slotTime,
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/check-in");
    revalidatePath("/dashboard/check-out");
  }

  return {
    ok: true as const,
    bookingId: booking.id,
    missingVaccines,
    confirmed: !requiresEntrada,
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

  await sendBookingConfirmedWhatsApp({
    tenant: booking.tenant,
    tutorName: booking.pet.tutor.name,
    tutorPhone: booking.pet.tutor.phone,
    petName: booking.pet.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
    slotTime: booking.slotTime,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/check-in");
  revalidatePath("/dashboard/check-out");
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
    species: booking.pet.species,
    castrated: booking.pet.castrated,
    vaccinated: booking.pet.vaccinated,
    aggressive: booking.pet.aggressive,
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
      error: "Só é possível registrar a entrada de reservas confirmadas.",
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
  revalidatePath("/dashboard/check-out");
  revalidatePath("/dashboard/daily-logs");

  return {
    ok: true as const,
    missingVaccines,
  };
}

export async function checkOutBooking(
  bookingId: string,
  returnedItemIds: string[] = [],
) {
  const { tenantId } = await requireStaffSession();
  const booking = await assertOwnedBooking(tenantId, bookingId);

  if (booking.status !== "CHECKED_IN") {
    return {
      ok: false as const,
      error: "Só é possível registrar a saída de pets hospedados.",
    };
  }

  const checklist = await prisma.checklistItem.findMany({
    where: { bookingId, tenantId },
    select: { id: true },
  });
  const returned = new Set(returnedItemIds);
  const missing = checklist.filter((item) => !returned.has(item.id));

  if (missing.length > 0) {
    return {
      ok: false as const,
      error: "Marque todos os pertences devolvidos para liberar a saída.",
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
  revalidatePath("/dashboard/check-out");
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
    castrated?: boolean | null;
    vaccinated?: boolean | null;
    aggressive?: boolean | null;
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
    castrated: booking.pet.castrated ?? null,
    vaccinated: booking.pet.vaccinated ?? null,
    aggressive: booking.pet.aggressive ?? null,
    tutorName: booking.pet.tutor.name,
    tutorPhone: booking.pet.tutor.phone,
  };
}
