import { z } from "zod";
import { phoneDigits } from "@/lib/utils";

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
  checkoutTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.")
    .optional(),
  tutor: z.object({
    name: z.string().min(2),
    phone: z
      .string()
      .transform((value) => phoneDigits(value))
      .pipe(z.string().min(10, "WhatsApp inválido.")),
    cpf: z.string().optional(),
    address: z.string().optional(),
    pix: z
      .object({
        kind: z.enum(["CPF", "EMAIL", "PHONE"]),
        key: z.string().min(1),
      })
      .optional(),
  }),
  pet: z.object({
    name: z.string().min(1),
    species: z.enum(["DOG", "CAT", "OTHER"]),
    breed: z.string().optional(),
    size: z.enum(["SMALL", "MEDIUM", "LARGE"]),
    birthDate: z.coerce.date().optional(),
    notes: z.string().optional(),
    castrated: z.boolean().optional(),
    vaccinated: z.boolean().optional(),
    aggressive: z.boolean().optional(),
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
