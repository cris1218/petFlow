"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";

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
