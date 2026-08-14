import { prisma } from "@/lib/prisma";
import {
  DEFAULT_APPOINTMENT_CAPACITY,
  DEFAULT_SLOT_DURATION_MIN,
  DEFAULT_STAY_CAPACITY,
  defaultWeekdays,
  generateTimeSlots,
  isPastDateKey,
  isPastSlot,
  occupiedStayDays,
  parseDateKey,
  toDateKey,
  weekdayFromDateKey,
  type WeekdayHours,
} from "@/lib/schedule";

const HOLDING = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export function serializeWeekday(row: {
  weekday: number;
  openTime: string;
  closeTime: string;
  closed: boolean;
}): WeekdayHours {
  return {
    weekday: row.weekday,
    openTime: row.openTime,
    closeTime: row.closeTime,
    closed: row.closed,
  };
}

export async function ensureTenantSchedule(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      weekdays: { select: { id: true }, take: 1 },
    },
  });

  if (!tenant || tenant.weekdays.length > 0) return;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      weekdays: {
        create: defaultWeekdays(),
      },
    },
  });
  await prisma.tenantService.updateMany({
    where: {
      tenantId,
      kind: "STAY",
      OR: [
        { name: { contains: "banho", mode: "insensitive" } },
        { name: { contains: "tosa", mode: "insensitive" } },
      ],
    },
    data: { kind: "APPOINTMENT" },
  });
}

export async function getTenantScheduleConfig(tenantId: string) {
  await ensureTenantSchedule(tenantId);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      stayCapacity: true,
      appointmentCapacity: true,
      slotDurationMin: true,
      acceptsCats: true,
      acceptsDogSmall: true,
      acceptsDogMedium: true,
      acceptsDogLarge: true,
      weekdays: { orderBy: { weekday: "asc" } },
    },
  });

  return {
    stayCapacity: tenant?.stayCapacity ?? DEFAULT_STAY_CAPACITY,
    appointmentCapacity: tenant?.appointmentCapacity ?? DEFAULT_APPOINTMENT_CAPACITY,
    slotDurationMin: tenant?.slotDurationMin ?? DEFAULT_SLOT_DURATION_MIN,
    acceptsCats: tenant?.acceptsCats ?? true,
    acceptsDogSmall: tenant?.acceptsDogSmall ?? true,
    acceptsDogMedium: tenant?.acceptsDogMedium ?? true,
    acceptsDogLarge: tenant?.acceptsDogLarge ?? true,
    weekdays: (tenant?.weekdays ?? defaultWeekdays()).map(serializeWeekday),
  };
}

function weekdayMap(weekdays: WeekdayHours[]) {
  return new Map(weekdays.map((day) => [day.weekday, day]));
}

export async function getStayAvailability(input: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}) {
  const config = await getTenantScheduleConfig(input.tenantId);
  const days = occupiedStayDays(input.startDate, input.endDate);

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId: input.tenantId,
      status: { in: [...HOLDING] },
      slotTime: null,
      startDate: { lte: parseDateKey(days[days.length - 1]) },
      endDate: { gte: parseDateKey(days[0]) },
    },
    select: { startDate: true, endDate: true },
  });

  const occupancy = new Map<string, number>();
  for (const day of days) occupancy.set(day, 0);
  for (const booking of bookings) {
    for (const day of occupiedStayDays(booking.startDate, booking.endDate)) {
      if (occupancy.has(day)) {
        occupancy.set(day, (occupancy.get(day) ?? 0) + 1);
      }
    }
  }

  const peak = Math.max(0, ...Array.from(occupancy.values()));
  const remaining = Math.max(0, config.stayCapacity - peak);
  const fullDays = days.filter(
    (day) => (occupancy.get(day) ?? 0) >= config.stayCapacity,
  );

  return {
    capacity: config.stayCapacity,
    remaining,
    available: remaining > 0,
    fullDays,
    occupancy: Object.fromEntries(occupancy),
  };
}

export async function getAppointmentSlots(input: {
  tenantId: string;
  dateKey: string;
}) {
  const config = await getTenantScheduleConfig(input.tenantId);
  const weekday = weekdayFromDateKey(input.dateKey);
  const hours = weekdayMap(config.weekdays).get(weekday);
  const pastDay = isPastDateKey(input.dateKey);

  if (!hours || hours.closed || pastDay) {
    return {
      closed: !hours || hours.closed,
      pastDay,
      slots: [] as Array<{ time: string; available: boolean }>,
      durationMin: config.slotDurationMin,
      capacity: config.appointmentCapacity,
    };
  }

  const generated = generateTimeSlots(
    hours.openTime,
    hours.closeTime,
    config.slotDurationMin,
  );

  const day = parseDateKey(input.dateKey);
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId: input.tenantId,
      status: { in: [...HOLDING] },
      slotTime: { not: null },
      startDate: {
        gte: new Date(`${input.dateKey}T00:00:00`),
        lte: new Date(`${input.dateKey}T23:59:59`),
      },
    },
    select: { slotTime: true },
  });

  const taken = new Map<string, number>();
  for (const booking of bookings) {
    if (!booking.slotTime) continue;
    taken.set(booking.slotTime, (taken.get(booking.slotTime) ?? 0) + 1);
  }

  return {
    closed: false,
    pastDay: false,
    durationMin: config.slotDurationMin,
    capacity: config.appointmentCapacity,
    slots: generated.map((time) => ({
      time,
      available:
        !isPastSlot(input.dateKey, time) &&
        (taken.get(time) ?? 0) < config.appointmentCapacity,
    })),
  };
}

export async function assertSlotAvailable(input: {
  tenantId: string;
  kind: "STAY" | "APPOINTMENT";
  startDate: Date;
  endDate: Date;
  slotTime?: string | null;
}) {
  if (input.kind === "STAY") {
    const stay = await getStayAvailability({
      tenantId: input.tenantId,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    if (!stay.available) {
      return {
        ok: false as const,
        error:
          stay.capacity <= 0
            ? "O hotel ainda não definiu a capacidade da agenda."
            : "Não há vaga nesse período. Escolha outras datas.",
      };
    }
    return { ok: true as const };
  }

  const dateKey = toDateKey(input.startDate);
  if (!input.slotTime) {
    return { ok: false as const, error: "Escolha um horário disponível." };
  }

  const slots = await getAppointmentSlots({
    tenantId: input.tenantId,
    dateKey,
  });
  if (slots.closed) {
    return { ok: false as const, error: "O hotel não atende neste dia." };
  }
  const slot = slots.slots.find((item) => item.time === input.slotTime);
  if (!slot?.available) {
    return {
      ok: false as const,
      error: "Esse horário já está ocupado. Escolha outro.",
    };
  }
  return { ok: true as const };
}
