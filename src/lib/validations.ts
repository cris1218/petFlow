import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres."),
});

export const updateAccountSchema = z.object({
  email: z.string().email("E-mail inválido."),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
});

export const createBookingSchema = z.object({
  tenantSlug: z.string().min(1),
  serviceId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  slotTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.")
    .optional(),
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
