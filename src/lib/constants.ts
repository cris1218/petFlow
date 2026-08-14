export const APP_NAME = "PetFlow";
export const APP_SLOGAN =
  "Hospedagem, agendamentos e diário de bordo direto no WhatsApp.";

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

export const SUPPORT_STATUS_LABELS = {
  OPEN: "Aberto",
  WAITING_HOTEL: "Aguardando hotel",
  WAITING_MASTER: "Aguardando suporte",
  CLOSED: "Encerrado",
} as const;

export const BOOKING_STATUS_LABELS = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Check-out",
  CANCELLED: "Cancelada",
} as const;

const LEGACY_SERVICE_LABELS: Record<string, string> = {
  HOTEL: "Hotel",
  DAYCARE: "Creche",
  GROOMING: "Banho e tosa",
};

export function serviceLabel(value: string) {
  return LEGACY_SERVICE_LABELS[value] ?? value;
}
