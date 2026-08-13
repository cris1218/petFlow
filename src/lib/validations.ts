import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres."),
});

export const createBookingSchema = z.object({
  tenantSlug: z.string().min(1),
  serviceType: z.enum(["HOTEL", "DAYCARE", "GROOMING"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  tutor: z.object({
    name: z.string().min(2),
    phone: z.string().min(10),
    cpf: z.string().optional(),
    address: z.string().optional(),
    email: z.union([z.string().email(), z.literal("")]).optional(),
  }),
  pet: z.object({
    name: z.string().min(1),
    species: z.enum(["DOG", "CAT", "OTHER"]),
    breed: z.string().optional(),
    size: z.enum(["SMALL", "MEDIUM", "LARGE"]),
    birthDate: z.coerce.date().optional(),
    notes: z.string().optional(),
  }),
  vaccines: z
    .array(
      z.object({
        name: z.string().min(1),
        applicationDate: z.coerce.date(),
        expirationDate: z.coerce.date(),
      }),
    )
    .optional()
    .default([]),
});

export const checkInSchema = z.object({
  bookingId: z.string().min(1),
  items: z
    .array(
      z.object({
        itemName: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .default([]),
});
