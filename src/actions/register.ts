"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { defaultServicesCreate } from "@/lib/services";
import { defaultBelongingsCreate, defaultVaccinesCreate } from "@/lib/check-in-catalog";
import { slugify } from "@/lib/utils";

export async function registerHotel(input: {
  hotelName: string;
  adminName: string;
  email: string;
  password: string;
  whatsapp?: string;
}) {
  const hotelName = input.hotelName.trim();
  const adminName = input.adminName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const whatsapp = input.whatsapp?.trim() || null;
  const slug = slugify(hotelName);

  if (hotelName.length < 2) {
    return { ok: false as const, error: "Informe o nome do hotel." };
  }
  if (!slug) {
    return { ok: false as const, error: "Nome do hotel inválido." };
  }
  if (adminName.length < 2) {
    return { ok: false as const, error: "Informe o nome do gestor." };
  }
  if (!email.includes("@")) {
    return { ok: false as const, error: "E-mail inválido." };
  }
  if (password.length < 6) {
    return { ok: false as const, error: "A senha deve ter ao menos 6 caracteres." };
  }

  const [slugTaken, emailTaken] = await Promise.all([
    prisma.tenant.findUnique({ where: { slug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);

  if (slugTaken) {
    return { ok: false as const, error: "Já existe um hotel com esse nome. Tente outro." };
  }
  if (emailTaken) {
    return { ok: false as const, error: "Esse e-mail já está em uso." };
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: hotelName,
      slug,
      status: "TRIAL",
      whatsappNumber: whatsapp,
      whatsappInstanceName: `petflow_${slug}`,
      users: {
        create: {
          name: adminName,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          role: "ADMIN",
        },
      },
      services: {
        create: defaultServicesCreate(),
      },
      belongings: {
        create: defaultBelongingsCreate(),
      },
      requiredVaccines: {
        create: defaultVaccinesCreate(),
      },
    },
    include: {
      users: { where: { role: "ADMIN" }, take: 1 },
    },
  });

  const admin = tenant.users[0];
  if (!admin) {
    return { ok: false as const, error: "Não foi possível criar o gestor." };
  }

  await createSession({
    userId: admin.id,
    tenantId: tenant.id,
    role: "ADMIN",
    email: admin.email,
  });

  redirect("/dashboard");
}
