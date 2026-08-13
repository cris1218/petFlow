"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";

export async function getTenantSettings() {
  const { user } = await requireStaffSession();
  const tenant = user.tenant;

  return {
    name: tenant.name,
    slug: tenant.slug,
    whatsappNumber: tenant.whatsappNumber ?? "",
    hotelRate: Number(tenant.hotelRate),
    daycareRate: Number(tenant.daycareRate),
    groomingRate: Number(tenant.groomingRate),
    depositRate: Number(tenant.depositRate),
    pixConfigured: Boolean(tenant.mpAccessTokenEnc),
  };
}

export async function saveTenantSettings(input: {
  whatsappNumber: string;
  hotelRate: number;
  daycareRate: number;
  groomingRate: number;
  depositRate: number;
  mpAccessToken?: string;
}) {
  const { tenantId } = await requireStaffSession();

  if (
    input.hotelRate <= 0 ||
    input.daycareRate <= 0 ||
    input.groomingRate <= 0 ||
    input.depositRate <= 0 ||
    input.depositRate > 1
  ) {
    return { ok: false as const, error: "Confira diárias e o percentual do sinal." };
  }

  const data: {
    whatsappNumber: string | null;
    hotelRate: number;
    daycareRate: number;
    groomingRate: number;
    depositRate: number;
    mpAccessTokenEnc?: string;
  } = {
    whatsappNumber: input.whatsappNumber.trim() || null,
    hotelRate: input.hotelRate,
    daycareRate: input.daycareRate,
    groomingRate: input.groomingRate,
    depositRate: input.depositRate,
  };

  const token = input.mpAccessToken?.trim();
  if (token) {
    data.mpAccessTokenEnc = encryptSecret(token);
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data,
  });

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/agendar");
  return { ok: true as const };
}

export async function removeMercadoPagoToken() {
  const { tenantId } = await requireStaffSession();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { mpAccessTokenEnc: null },
  });
  revalidatePath("/dashboard/configuracoes");
  return { ok: true as const };
}
