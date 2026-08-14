export const APP_NAME = "PetFlow";
export const APP_SLOGAN =
  "Hospedagem, agendamentos e diário de bordo direto no WhatsApp.";

export const LOGO_UPLOAD_HINT =
  "PNG com fundo transparente (recomendado), quadrado 400×400 px até 800×800 px, máximo 2 MB. Assim o logo cabe no topo sem estourar a tela. WEBP também serve; evite JPG com fundo branco.";

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

export function catCareLabels(pet: {
  castrated?: boolean | null;
  vaccinated?: boolean | null;
  aggressive?: boolean | null;
}) {
  return [
    pet.castrated ? "Castrado" : "Não castrado",
    pet.vaccinated ? "Tomou vacina" : "Sem vacina",
    pet.aggressive ? "Agressivo" : "Não agressivo",
  ];
}

export function hasPetCareProfile(species?: string | null) {
  return species === "CAT" || species === "DOG";
}

export const SIZE_LABELS = {
  SMALL: "Pequeno",
  MEDIUM: "Médio",
  LARGE: "Grande",
} as const;

export type PetSize = keyof typeof SIZE_LABELS;

export const DOG_SIZES: PetSize[] = ["SMALL", "MEDIUM", "LARGE"];

export type PetPolicy = {
  acceptsCats: boolean;
  dogSizes: PetSize[];
};

export function dogSizesFromFlags(flags: {
  acceptsDogSmall: boolean;
  acceptsDogMedium: boolean;
  acceptsDogLarge: boolean;
}): PetSize[] {
  const sizes: PetSize[] = [];
  if (flags.acceptsDogSmall) sizes.push("SMALL");
  if (flags.acceptsDogMedium) sizes.push("MEDIUM");
  if (flags.acceptsDogLarge) sizes.push("LARGE");
  return sizes;
}

export function allowedSpecies(policy: PetPolicy) {
  const species: Array<keyof typeof SPECIES_LABELS> = [];
  if (policy.dogSizes.length > 0) species.push("DOG");
  if (policy.acceptsCats) species.push("CAT");
  if (policy.dogSizes.length > 0) species.push("OTHER");
  return species;
}

export function sizesForSpecies(
  species: keyof typeof SPECIES_LABELS,
  policy: PetPolicy,
): PetSize[] {
  if (species === "CAT") return policy.acceptsCats ? ["SMALL"] : [];
  return policy.dogSizes;
}

export const SUPPORT_STATUS_LABELS = {
  OPEN: "Aberto",
  WAITING_HOTEL: "Aguardando hotel",
  WAITING_MASTER: "Aguardando suporte",
  CLOSED: "Encerrado",
} as const;

export const BOOKING_STATUS_LABELS = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "Entrada",
  CHECKED_OUT: "Saída",
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
