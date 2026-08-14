"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { loginSchema, updateAccountSchema } from "@/lib/validations";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false as const, error: "Informe e-mail e senha válidos." };
  }

  let user;

  try {
    user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { tenant: true },
    });
  } catch (error) {
    console.error("[login]", error);
    return {
      ok: false as const,
      error:
        "Não foi possível conectar ao banco. Reinicie o yarn dev para carregar o .env do Supabase.",
    };
  }

  if (!user) {
    return { ok: false as const, error: "Credenciais inválidas." };
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { ok: false as const, error: "Credenciais inválidas." };
  }

  if (user.role === "MASTER") {
    await createSession({
      userId: user.id,
      tenantId: null,
      role: user.role,
      email: user.email,
    });
    redirect("/admin");
  }

  if (!user.tenant) {
    return { ok: false as const, error: "Usuário sem estabelecimento." };
  }

  if (user.tenant.status === "SUSPENDED") {
    return { ok: false as const, error: "Estabelecimento suspenso." };
  }

  await createSession({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function getAccountProfile() {
  const session = await getSession();
  if (!session) {
    throw new Error("Não autenticado.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    throw new Error("Sessão inválida.");
  }

  return user;
}

export async function updateAccountAction(input: {
  email: string;
  newPassword?: string;
  confirmPassword?: string;
}) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Não autenticado." };
  }

  const parsed = updateAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Confira e-mail e senha." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const newPassword = parsed.data.newPassword?.trim() ?? "";
  const confirmPassword = parsed.data.confirmPassword?.trim() ?? "";

  if (newPassword && newPassword.length < 6) {
    return { ok: false as const, error: "A nova senha deve ter ao menos 6 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false as const, error: "A confirmação da nova senha não confere." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user) {
    return { ok: false as const, error: "Sessão inválida." };
  }

  if (email !== user.email) {
    const taken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (taken) {
      return { ok: false as const, error: "Esse e-mail já está em uso." };
    }
  }

  const data: { email: string; passwordHash?: string } = { email };
  if (newPassword) {
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  await createSession({
    userId: user.id,
    tenantId: session.tenantId,
    role: session.role,
    email,
  });

  return { ok: true as const };
}
