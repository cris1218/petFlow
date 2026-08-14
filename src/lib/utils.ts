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

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
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

export function phoneDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

export function formatWhatsAppMask(value: string) {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function toWhatsAppNumber(phone: string) {
  const digits = phoneDigits(phone);
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function cpfDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatCpfMask(value: string) {
  const digits = cpfDigits(value);
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export type PixKeyKind = "CPF" | "EMAIL" | "PHONE";

export function pixPayerEmail(kind: PixKeyKind, value: string) {
  if (kind === "EMAIL") return value.trim().toLowerCase();
  if (kind === "CPF") return `cpf${cpfDigits(value)}@pagador.petflow.app`;
  return `cel${phoneDigits(value)}@pagador.petflow.app`;
}

export function cepDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatCepMask(value: string) {
  const digits = cepDigits(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatFullAddress(input: {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
  cep?: string;
}) {
  const streetLine = [input.street?.trim(), input.number?.trim()]
    .filter(Boolean)
    .join(", ");
  const withComplement = input.complement?.trim()
    ? `${streetLine}${streetLine ? ", " : ""}${input.complement.trim()}`
    : streetLine;
  const cityLine = [input.neighborhood?.trim(), [input.city?.trim(), input.uf?.trim()].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" · ");
  const cep = input.cep ? formatCepMask(input.cep) : "";
  return [withComplement, cityLine, cep ? `CEP ${cep}` : ""].filter(Boolean).join(" — ");
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
