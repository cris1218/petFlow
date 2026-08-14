"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";
import { getAppUrl } from "@/lib/app-url";

export async function getPlatformMpSettings() {
  await requireMasterSession();

  const settings = await prisma.platformSettings.findUnique({
    where: { id: "platform" },
    select: { mpAccessTokenEnc: true, updatedAt: true },
  });

  return {
    pixConfigured: Boolean(settings?.mpAccessTokenEnc),
    webhookUrl: `${getAppUrl()}/api/webhooks/mercadopago`,
  };
}

export async function savePlatformMpToken(token?: string) {
  await requireMasterSession();

  const trimmed = token?.trim();
  if (!trimmed) {
    return { ok: false as const, error: "Informe o Access Token do Mercado Pago." };
  }

  await prisma.platformSettings.upsert({
    where: { id: "platform" },
    create: {
      id: "platform",
      mpAccessTokenEnc: encryptSecret(trimmed),
    },
    update: {
      mpAccessTokenEnc: encryptSecret(trimmed),
    },
  });

  revalidatePath("/admin/conta");
  revalidatePath("/admin");
  revalidatePath("/dashboard/plano");
  return { ok: true as const };
}

export async function removePlatformMpToken() {
  await requireMasterSession();

  await prisma.platformSettings.upsert({
    where: { id: "platform" },
    create: { id: "platform", mpAccessTokenEnc: null },
    update: { mpAccessTokenEnc: null },
  });

  revalidatePath("/admin/conta");
  revalidatePath("/admin");
  revalidatePath("/dashboard/plano");
  return { ok: true as const };
}
