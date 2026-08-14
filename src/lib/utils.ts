import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(value: string) {
  return value;
}

export function formatBookingWhen(
  startDate: Date | string,
  endDate: Date | string,
  slotTime?: string | null,
) {
  const start = formatDate(startDate);
  if (slotTime) {
    return `${start} às ${slotTime}`;
  }
  const end = formatDate(endDate);
  return start === end ? start : `${start} → ${end}`;
}

export function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function vaccineStatusFromExpiration(expirationDate: Date) {
  return expirationDate.getTime() < Date.now() ? "EXPIRED" : "VALID";
}
