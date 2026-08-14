export const SERVICE_KINDS = ["STAY", "APPOINTMENT"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  STAY: "Estadia (hotel / creche)",
  APPOINTMENT: "Horário (banho e tosa)",
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  0: "Domingo",
};

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const DEFAULT_SLOT_DURATION_MIN = 60;
export const DEFAULT_STAY_CAPACITY = 10;
export const DEFAULT_APPOINTMENT_CAPACITY = 1;

export type WeekdayHours = {
  weekday: number;
  openTime: string;
  closeTime: string;
  closed: boolean;
};

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function defaultWeekdays(): WeekdayHours[] {
  return WEEKDAY_ORDER.map((weekday) => ({
    weekday,
    openTime: "08:00",
    closeTime: "18:00",
    closed: weekday === 0,
  }));
}

export function inferServiceKind(name: string): ServiceKind {
  return /(banho|tosa|groom)/i.test(name) ? "APPOINTMENT" : "STAY";
}

export function toDateKey(value: Date | string) {
  const date = typeof value === "string" ? parseDateKey(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

export function weekdayFromDateKey(dateKey: string) {
  return parseDateKey(dateKey).getDay();
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  durationMin: number,
) {
  if (!TIME_PATTERN.test(openTime) || !TIME_PATTERN.test(closeTime)) return [];
  const duration = Math.max(15, durationMin);
  const start = timeToMinutes(openTime);
  const end = timeToMinutes(closeTime);
  if (end <= start) return [];

  const slots: string[] = [];
  for (let cursor = start; cursor + duration <= end; cursor += duration) {
    slots.push(minutesToTime(cursor));
  }
  return slots;
}

export function occupiedStayDays(startDate: Date, endDate: Date) {
  const start = parseDateKey(toDateKey(startDate));
  const end = parseDateKey(toDateKey(endDate));
  const days: string[] = [];
  const cursor = new Date(start);

  if (end.getTime() <= start.getTime()) {
    return [toDateKey(start)];
  }

  while (cursor < end) {
    days.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function eachDateKey(startDate: Date, endDate: Date) {
  const start = parseDateKey(toDateKey(startDate));
  const end = parseDateKey(toDateKey(endDate));
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function isPastDateKey(dateKey: string) {
  return parseDateKey(dateKey) < parseDateKey(toDateKey(new Date()));
}

export function isPastSlot(dateKey: string, time: string) {
  const slot = new Date(`${dateKey}T${time}:00`);
  return slot.getTime() <= Date.now();
}

export const ACTIVE_SCHEDULE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
] as const;
