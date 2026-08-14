"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHotelAdminSession } from "@/lib/auth";
import {
  ensureTenantSchedule,
  getAppointmentSlots,
  getStayAvailability,
  getTenantScheduleConfig,
} from "@/lib/tenant-schedule";

export async function getPublicStayAvailability(input: {
  tenantSlug: string;
  serviceId: string;
  startDate: string;
  endDate: string;
  checkoutTime?: string;
  species?: "DOG" | "CAT" | "OTHER";
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
    select: { id: true, status: true },
  });
  if (!tenant || tenant.status === "SUSPENDED") {
    return { ok: false as const, error: "Estabelecimento indisponível." };
  }

  const startDate = new Date(`${input.startDate}T12:00:00`);
  const endDate = new Date(`${input.endDate}T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return { ok: false as const, error: "Período inválido." };
  }

  const availability = await getStayAvailability({
    tenantId: tenant.id,
    serviceId: input.serviceId,
    startDate,
    endDate,
    checkoutTime: input.checkoutTime,
    species: input.species,
  });

  return { ok: true as const, ...availability };
}

export async function getPublicAppointmentSlots(input: {
  tenantSlug: string;
  serviceId: string;
  date: string;
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
    select: { id: true, status: true },
  });
  if (!tenant || tenant.status === "SUSPENDED") {
    return { ok: false as const, error: "Estabelecimento indisponível." };
  }

  const slots = await getAppointmentSlots({
    tenantId: tenant.id,
    serviceId: input.serviceId,
    dateKey: input.date,
  });

  return {
    ok: true as const,
    closed: slots.closed,
    pastDay: slots.pastDay,
    durationMin: slots.durationMin,
    slots: slots.slots,
  };
}

export async function saveHotelSchedule(input: {
  acceptsCatSmall: boolean;
  acceptsCatMedium: boolean;
  acceptsCatLarge: boolean;
  acceptsDogSmall: boolean;
  acceptsDogMedium: boolean;
  acceptsDogLarge: boolean;
}) {
  const { tenantId, user } = await requireHotelAdminSession();
  await ensureTenantSchedule(tenantId);

  const acceptsCats =
    input.acceptsCatSmall || input.acceptsCatMedium || input.acceptsCatLarge;

  if (
    !acceptsCats &&
    !input.acceptsDogSmall &&
    !input.acceptsDogMedium &&
    !input.acceptsDogLarge
  ) {
    return {
      ok: false as const,
      error: "Escolha ao menos um porte de gato ou de cão.",
    };
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      acceptsCats,
      acceptsCatSmall: input.acceptsCatSmall,
      acceptsCatMedium: input.acceptsCatMedium,
      acceptsCatLarge: input.acceptsCatLarge,
      acceptsDogSmall: input.acceptsDogSmall,
      acceptsDogMedium: input.acceptsDogMedium,
      acceptsDogLarge: input.acceptsDogLarge,
    },
  });

  revalidatePath("/dashboard/configuracoes");
  revalidatePath(`/agendar/${user.tenant.slug}`);
  return { ok: true as const };
}

export async function getHotelSchedule() {
  const { tenantId } = await requireHotelAdminSession();
  return getTenantScheduleConfig(tenantId);
}
