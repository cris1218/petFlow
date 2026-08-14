import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DAILY_CUTOFF,
  defaultWeekdays,
  eachDateKey,
  effectiveServiceKind,
  generateTimeSlots,
  isPastDateKey,
  isPastSlot,
  occupiedStayDays,
  parseDateKey,
  toDateKey,
  weekdayFromDateKey,
  type ServiceKind,
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

async function copyTenantWeekdaysToService(serviceId: string, tenantId: string) {
  const existing = await prisma.tenantService.findUnique({
    where: { id: serviceId },
    select: { weekdays: { select: { id: true }, take: 1 } },
  });
  if (existing?.weekdays.length) return;

  const tenantDays = await prisma.tenantWeekday.findMany({
    where: { tenantId },
  });
  const source = tenantDays.length ? tenantDays.map(serializeWeekday) : defaultWeekdays();
  await prisma.tenantService.update({
    where: { id: serviceId },
    data: {
      weekdays: {
        create: source,
      },
    },
  });
}

export async function ensureServiceWeekdays(serviceId: string, tenantId: string) {
  await copyTenantWeekdaysToService(serviceId, tenantId);
}

export async function ensureTenantSchedule(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      stayCapacity: true,
      weekdays: { select: { id: true }, take: 1 },
    },
  });

  if (!tenant) return;

  if (tenant.weekdays.length === 0) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        weekdays: {
          create: defaultWeekdays(),
        },
      },
    });
  }

  await prisma.tenantService.updateMany({
    where: {
      tenantId,
      kind: "STAY",
      OR: [
        { name: { contains: "creche", mode: "insensitive" } },
        { name: { contains: "day care", mode: "insensitive" } },
        { name: { contains: "daycare", mode: "insensitive" } },
        { name: { contains: "petsit", mode: "insensitive" } },
        { name: { contains: "pet sitter", mode: "insensitive" } },
        { name: { contains: "pet-sitter", mode: "insensitive" } },
      ],
    },
    data: { kind: "DAYCARE", periodCapacity: tenant.stayCapacity || 10 },
  });

  const timed = await prisma.tenantService.findMany({
    where: { tenantId, kind: { in: ["DAYCARE", "APPOINTMENT"] } },
    select: { id: true },
  });
  for (const service of timed) {
    await copyTenantWeekdaysToService(service.id, tenantId);
  }
}

export async function getTenantScheduleConfig(tenantId: string) {
  await ensureTenantSchedule(tenantId);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      acceptsCats: true,
      acceptsCatSmall: true,
      acceptsCatMedium: true,
      acceptsCatLarge: true,
      acceptsDogSmall: true,
      acceptsDogMedium: true,
      acceptsDogLarge: true,
    },
  });

  return {
    acceptsCats: tenant?.acceptsCats ?? true,
    acceptsCatSmall: tenant?.acceptsCatSmall ?? true,
    acceptsCatMedium: tenant?.acceptsCatMedium ?? true,
    acceptsCatLarge: tenant?.acceptsCatLarge ?? true,
    acceptsDogSmall: tenant?.acceptsDogSmall ?? true,
    acceptsDogMedium: tenant?.acceptsDogMedium ?? true,
    acceptsDogLarge: tenant?.acceptsDogLarge ?? true,
  };
}

function weekdayMap(weekdays: WeekdayHours[]) {
  return new Map(weekdays.map((day) => [day.weekday, day]));
}

type ServiceSchedule = {
  id: string;
  kind: ServiceKind;
  dailyCutoffTime: string;
  catCapacity: number;
  dogCapacity: number;
  periodCapacity: number;
  slotDurationMin: number;
  slotCapacity: number;
  weekdays: WeekdayHours[];
};

async function getServiceSchedule(
  tenantId: string,
  serviceId: string,
): Promise<ServiceSchedule | null> {
  await ensureTenantSchedule(tenantId);
  const service = await prisma.tenantService.findFirst({
    where: { id: serviceId, tenantId, active: true },
    include: { weekdays: true },
  });
  if (!service) return null;

  const kind = effectiveServiceKind(service.kind, service.name);

  if (kind !== "STAY" && service.weekdays.length === 0) {
    await copyTenantWeekdaysToService(service.id, tenantId);
    const again = await prisma.tenantService.findFirst({
      where: { id: service.id },
      include: { weekdays: true },
    });
    if (again) {
      return {
        id: again.id,
        kind: effectiveServiceKind(again.kind, again.name),
        dailyCutoffTime: again.dailyCutoffTime,
        catCapacity: again.catCapacity,
        dogCapacity: again.dogCapacity,
        periodCapacity: again.periodCapacity,
        slotDurationMin: again.slotDurationMin,
        slotCapacity: again.slotCapacity,
        weekdays: again.weekdays.map(serializeWeekday),
      };
    }
  }

  return {
    id: service.id,
    kind,
    dailyCutoffTime: service.dailyCutoffTime || DEFAULT_DAILY_CUTOFF,
    catCapacity: service.catCapacity,
    dogCapacity: service.dogCapacity,
    periodCapacity: service.periodCapacity,
    slotDurationMin: service.slotDurationMin,
    slotCapacity: service.slotCapacity,
    weekdays: service.weekdays.map(serializeWeekday),
  };
}

function speciesCapacity(service: ServiceSchedule, species?: string | null) {
  if (species === "CAT") return service.catCapacity;
  return service.dogCapacity;
}

function occupancyForDays(
  days: string[],
  bookings: Array<{
    startDate: Date;
    endDate: Date;
    checkoutTime?: string | null;
    species?: string | null;
  }>,
  cutoffTime: string,
  extraNight: boolean,
) {
  const occupancy = new Map<string, number>();
  for (const day of days) occupancy.set(day, 0);
  for (const booking of bookings) {
    const booked = extraNight
      ? occupiedStayDays(booking.startDate, booking.endDate, booking.checkoutTime, cutoffTime)
      : eachDateKey(booking.startDate, booking.endDate);
    for (const day of booked) {
      if (occupancy.has(day)) {
        occupancy.set(day, (occupancy.get(day) ?? 0) + 1);
      }
    }
  }
  return occupancy;
}

export async function getStayAvailability(input: {
  tenantId: string;
  serviceId: string;
  startDate: Date;
  endDate: Date;
  species?: "DOG" | "CAT" | "OTHER";
  checkoutTime?: string | null;
}) {
  const service = await getServiceSchedule(input.tenantId, input.serviceId);
  if (!service) {
    return {
      capacity: 0,
      remaining: 0,
      available: false,
      fullDays: [] as string[],
      closedDays: [] as string[],
      catCapacity: 0,
      dogCapacity: 0,
      catRemaining: 0,
      dogRemaining: 0,
      extraNight: false,
    };
  }

  const isHotel = service.kind === "STAY";
  const cutoff = service.dailyCutoffTime || DEFAULT_DAILY_CUTOFF;
  const extraNight = Boolean(
    isHotel &&
      input.checkoutTime &&
      input.checkoutTime > cutoff,
  );
  const days = isHotel
    ? occupiedStayDays(input.startDate, input.endDate, input.checkoutTime, cutoff)
    : eachDateKey(input.startDate, input.endDate);
  const hours = weekdayMap(service.weekdays);
  const closedDays = isHotel
    ? []
    : days.filter((day) => hours.get(weekdayFromDateKey(day))?.closed);

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId: input.tenantId,
      serviceId: service.id,
      status: { in: [...HOLDING] },
      startDate: { lte: parseDateKey(days[days.length - 1] ?? toDateKey(input.endDate)) },
      endDate: { gte: parseDateKey(days[0] ?? toDateKey(input.startDate)) },
    },
    select: {
      startDate: true,
      endDate: true,
      checkoutTime: true,
      pet: { select: { species: true } },
    },
  });

  const mapped = bookings.map((booking) => ({
    startDate: booking.startDate,
    endDate: booking.endDate,
    checkoutTime: booking.checkoutTime,
    species: booking.pet.species,
  }));

  const cats = occupancyForDays(
    days,
    mapped.filter((booking) => booking.species === "CAT"),
    cutoff,
    isHotel,
  );
  const dogs = occupancyForDays(
    days,
    mapped.filter((booking) => booking.species !== "CAT"),
    cutoff,
    isHotel,
  );

  const peakCats = Math.max(0, ...Array.from(cats.values()));
  const peakDogs = Math.max(0, ...Array.from(dogs.values()));
  const catRemaining = Math.max(0, service.catCapacity - peakCats);
  const dogRemaining = Math.max(0, service.dogCapacity - peakDogs);

  if (!isHotel) {
    const occupancy = occupancyForDays(days, mapped, cutoff, false);
    const peak = Math.max(0, ...Array.from(occupancy.values()));
    const remaining = Math.max(0, service.periodCapacity - peak);
    const fullDays = days.filter(
      (day) => (occupancy.get(day) ?? 0) >= service.periodCapacity,
    );
    return {
      capacity: service.periodCapacity,
      remaining,
      available: remaining > 0 && closedDays.length === 0,
      fullDays,
      closedDays,
      catCapacity: service.catCapacity,
      dogCapacity: service.dogCapacity,
      catRemaining,
      dogRemaining,
      extraNight: false,
    };
  }

  const capacity = speciesCapacity(service, input.species);
  const remaining =
    input.species === "CAT"
      ? catRemaining
      : input.species
        ? dogRemaining
        : Math.max(catRemaining, dogRemaining);
  const fullDays = days.filter((day) => {
    if (input.species === "CAT") return (cats.get(day) ?? 0) >= service.catCapacity;
    if (input.species) return (dogs.get(day) ?? 0) >= service.dogCapacity;
    return (
      (cats.get(day) ?? 0) >= service.catCapacity &&
      (dogs.get(day) ?? 0) >= service.dogCapacity
    );
  });

  return {
    capacity,
    remaining,
    available: remaining > 0,
    fullDays,
    closedDays,
    catCapacity: service.catCapacity,
    dogCapacity: service.dogCapacity,
    catRemaining,
    dogRemaining,
    extraNight,
  };
}

export async function getAppointmentSlots(input: {
  tenantId: string;
  serviceId: string;
  dateKey: string;
}) {
  const service = await getServiceSchedule(input.tenantId, input.serviceId);
  const weekday = weekdayFromDateKey(input.dateKey);
  const hours = service ? weekdayMap(service.weekdays).get(weekday) : undefined;
  const pastDay = isPastDateKey(input.dateKey);
  const durationMin = service?.slotDurationMin ?? 30;
  const capacity = service?.slotCapacity ?? 1;

  if (!service || !hours || hours.closed || pastDay) {
    return {
      closed: !hours || hours.closed,
      pastDay,
      slots: [] as Array<{ time: string; available: boolean }>,
      durationMin,
      capacity,
    };
  }

  const generated = generateTimeSlots(hours.openTime, hours.closeTime, durationMin);
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId: input.tenantId,
      serviceId: service.id,
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
    durationMin,
    capacity,
    slots: generated.map((time) => ({
      time,
      available:
        !isPastSlot(input.dateKey, time) && (taken.get(time) ?? 0) < capacity,
    })),
  };
}

export async function assertSlotAvailable(input: {
  tenantId: string;
  serviceId: string;
  kind: ServiceKind;
  startDate: Date;
  endDate: Date;
  slotTime?: string | null;
  checkoutTime?: string | null;
  species?: "DOG" | "CAT" | "OTHER";
}) {
  if (input.kind === "APPOINTMENT") {
    const dateKey = toDateKey(input.startDate);
    if (!input.slotTime) {
      return { ok: false as const, error: "Escolha um horário disponível." };
    }
    const slots = await getAppointmentSlots({
      tenantId: input.tenantId,
      serviceId: input.serviceId,
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

  const stay = await getStayAvailability({
    tenantId: input.tenantId,
    serviceId: input.serviceId,
    startDate: input.startDate,
    endDate: input.endDate,
    species: input.species,
    checkoutTime: input.checkoutTime,
  });

  if (stay.closedDays.length > 0) {
    return {
      ok: false as const,
      error: "Não atende em um dos dias escolhidos.",
    };
  }
  if (!stay.available) {
    return {
      ok: false as const,
      error:
        stay.capacity <= 0
          ? "O hotel ainda não definiu a capacidade da agenda."
          : "Está com a lotação máxima nesse período. Escolha outras datas.",
    };
  }
  return { ok: true as const };
}
