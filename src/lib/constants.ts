import { ServiceType } from "@prisma/client";

export const APP_NAME = "PetFlow";
export const APP_SLOGAN =
  "Hospedagem, agendamentos e diário de bordo direto no WhatsApp.";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  HOTEL: "Hotel",
  DAYCARE: "Creche",
  GROOMING: "Banho e tosa",
};

export const SERVICE_DAILY_RATE: Record<ServiceType, number> = {
  HOTEL: 80,
  DAYCARE: 50,
  GROOMING: 70,
};

export const DEPOSIT_RATE = 0.3;

export const QUICK_STATUS_NOTES = [
  "Já almoçou",
  "Brincando no jardim",
  "Hora da soneca",
  "Passeio no parque",
  "Hora do banho",
  "Descansando no quarto",
] as const;

export const SPECIES_LABELS = {
  DOG: "Cão",
  CAT: "Gato",
  OTHER: "Outro",
} as const;

export const SIZE_LABELS = {
  SMALL: "Pequeno",
  MEDIUM: "Médio",
  LARGE: "Grande",
} as const;

export const BOOKING_STATUS_LABELS = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Check-out",
  CANCELLED: "Cancelada",
} as const;
