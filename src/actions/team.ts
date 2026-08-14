"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHotelAdminSession } from "@/lib/auth";

export async function listHotelStaff() {
  const { tenantId } = await requireHotelAdminSession();

  return prisma.user.findMany({
    where: { tenantId, role: "STAFF" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });
}

export async function createHotelStaff(input: {
  name: string;
  email: string;
  password: string;
}) {
  const { tenantId } = await requireHotelAdminSession();

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (name.length < 2) {
    return { ok: false as const, error: "Informe o nome da pessoa." };
  }
  if (!email.includes("@")) {
    return { ok: false as const, error: "E-mail inválido." };
  }
  if (password.length < 6) {
    return { ok: false as const, error: "A senha deve ter ao menos 6 caracteres." };
  }

  const taken = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (taken) {
    return { ok: false as const, error: "Esse e-mail já está em uso." };
  }

  const user = await prisma.user.create({
    data: {
      tenantId,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "STAFF",
    },
    select: { id: true, name: true, email: true },
  });

  revalidatePath("/dashboard/equipe");
  revalidatePath("/dashboard/configuracoes");
  return {
    ok: true as const,
    user,
    password,
  };
}

export async function resetStaffPassword(input: {
  userId: string;
  newPassword: string;
}) {
  const { tenantId } = await requireHotelAdminSession();
  const password = input.newPassword.trim();

  if (password.length < 6) {
    return { ok: false as const, error: "A senha deve ter ao menos 6 caracteres." };
  }

  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId, role: "STAFF" },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return { ok: false as const, error: "Usuário da equipe não encontrado." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  revalidatePath("/dashboard/equipe");
  revalidatePath("/dashboard/configuracoes");
  return {
    ok: true as const,
    email: user.email,
    name: user.name,
    password,
  };
}

export async function removeHotelStaff(userId: string) {
  const { tenantId, user } = await requireHotelAdminSession();

  if (userId === user.id) {
    return { ok: false as const, error: "Você não pode remover a própria conta." };
  }

  const staff = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: "STAFF" },
    select: { id: true },
  });

  if (!staff) {
    return { ok: false as const, error: "Usuário da equipe não encontrado." };
  }

  try {
    await prisma.user.delete({ where: { id: staff.id } });
  } catch {
    return {
      ok: false as const,
      error:
        "Não foi possível remover este usuário. Ele pode ter pedidos de suporte vinculados.",
    };
  }

  revalidatePath("/dashboard/equipe");
  revalidatePath("/dashboard/configuracoes");
  return { ok: true as const };
}
