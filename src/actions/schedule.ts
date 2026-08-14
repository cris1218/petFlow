"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHotelAdminSession } from "@/lib/auth";
import {
  TIME_PATTERN,
  WEEKDAY_ORDER,
  type WeekdayHours,
} from "@/lib/schedule";
import {
  ensureTenantSchedule,
  getAppointmentSlots,
  getStayAvailability,
  getTenantScheduleConfig,
} from "@/lib/tenant-schedule";

export async function getPublicStayAvailability(input: {
  tenantSlug: string;
  startDate: string;
  endDate: string;
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
    startDate,
    endDate,
  });

  return { ok: true as const, ...availability };
}

export async function getPublicAppointmentSlots(input: {
  tenantSlug: string;
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
  stayCapacity: number;
  appointmentCapacity: number;
  slotDurationMin: number;
  acceptsCats: boolean;
  acceptsDogSmall: boolean;
  acceptsDogMedium: boolean;
  acceptsDogLarge: boolean;
  weekdays: WeekdayHours[];
}) {
  const { tenantId, user } = await requireHotelAdminSession();
  await ensureTenantSchedule(tenantId);

  const stayCapacity = Math.floor(Number(input.stayCapacity));
  const appointmentCapacity = Math.floor(Number(input.appointmentCapacity));
  const slotDurationMin = Math.floor(Number(input.slotDurationMin));

  if (!Number.isFinite(stayCapacity) || stayCapacity < 1 || stayCapacity > 200) {
    return { ok: false as const, error: "A capacidade do hotel deve ser entre 1 e 200." };
  }
  if (
    !Number.isFinite(appointmentCapacity) ||
    appointmentCapacity < 1 ||
    appointmentCapacity > 20
  ) {
    return {
      ok: false as const,
      error: "Quantos atendimentos ao mesmo tempo: informe de 1 a 20.",
    };
  }
  if (
    !Number.isFinite(slotDurationMin) ||
    slotDurationMin < 15 ||
    slotDurationMin > 240
  ) {
    return {
      ok: false as const,
      error: "A duração do horário deve ser entre 15 e 240 minutos.",
    };
  }

  if (
    !input.acceptsCats &&
    !input.acceptsDogSmall &&
    !input.acceptsDogMedium &&
    !input.acceptsDogLarge
  ) {
    return {
      ok: false as const,
      error: "Escolha ao menos gatos ou um porte de cão.",
    };
  }

  const byWeekday = new Map(input.weekdays.map((day) => [day.weekday, day]));
  for (const weekday of WEEKDAY_ORDER) {
    const day = byWeekday.get(weekday);
    if (!day) {
      return { ok: false as const, error: "Informe os horários de todos os dias." };
    }
    if (!day.closed) {
      if (!TIME_PATTERN.test(day.openTime) || !TIME_PATTERN.test(day.closeTime)) {
        return { ok: false as const, error: "Use horários no formato 08:00." };
      }
      if (day.closeTime <= day.openTime) {
        return {
          ok: false as const,
          error: "O horário de fechamento deve ser depois da abertura.",
        };
      }
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stayCapacity,
      appointmentCapacity,
      slotDurationMin,
      acceptsCats: input.acceptsCats,
      acceptsDogSmall: input.acceptsDogSmall,
      acceptsDogMedium: input.acceptsDogMedium,
      acceptsDogLarge: input.acceptsDogLarge,
      weekdays: {
        deleteMany: {},
        create: WEEKDAY_ORDER.map((weekday) => {
          const day = byWeekday.get(weekday)!;
          return {
            weekday,
            openTime: day.openTime,
            closeTime: day.closeTime,
            closed: day.closed,
          };
        }),
      },
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
