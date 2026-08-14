"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHotelAdminSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";
import { deleteHotelLogo, uploadHotelLogo } from "@/lib/cloudinary";
import {
  ensureTenantServices,
  serializeTenantService,
} from "@/lib/services";
import { inferServiceKind, type ServiceKind } from "@/lib/schedule";
import { ensureTenantSchedule, getTenantScheduleConfig } from "@/lib/tenant-schedule";

function revalidateHotel(slug: string) {
  revalidatePath("/dashboard/configuracoes");
  revalidatePath(`/agendar/${slug}`);
}

export async function getTenantSettings() {
  const { user } = await requireHotelAdminSession();
  const tenant = user.tenant;
  await ensureTenantServices(tenant);
  await ensureTenantSchedule(tenant.id);

  const services = await prisma.tenantService.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const schedule = await getTenantScheduleConfig(tenant.id);

  return {
    name: tenant.name,
    slug: tenant.slug,
    whatsappNumber: tenant.whatsappNumber ?? "",
    depositRate: Number(tenant.depositRate),
    pixConfigured: Boolean(tenant.mpAccessTokenEnc),
    logoUrl: tenant.logoUrl,
    services: services.map(serializeTenantService),
    schedule,
  };
}

export async function saveHotelWhatsApp(whatsappNumber: string) {
  const { tenantId, user } = await requireHotelAdminSession();

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { whatsappNumber: whatsappNumber.trim() || null },
  });

  revalidateHotel(user.tenant.slug);
  return { ok: true as const };
}

export async function saveDepositRate(depositRate: number) {
  const { tenantId, user } = await requireHotelAdminSession();

  if (depositRate <= 0 || depositRate > 1) {
    return { ok: false as const, error: "O sinal deve ser um percentual entre 1% e 100%." };
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { depositRate },
  });

  revalidateHotel(user.tenant.slug);
  return { ok: true as const };
}

export async function saveMercadoPagoToken(mpAccessToken: string) {
  const { tenantId, user } = await requireHotelAdminSession();
  const token = mpAccessToken.trim();

  if (!token) {
    return { ok: false as const, error: "Informe o Access Token do Mercado Pago." };
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { mpAccessTokenEnc: encryptSecret(token) },
  });

  revalidateHotel(user.tenant.slug);
  return { ok: true as const };
}

export async function createTenantService(input: {
  name: string;
  price: number;
  kind?: ServiceKind;
}) {
  const { tenantId, user } = await requireHotelAdminSession();
  const name = input.name.trim();
  const price = Number(input.price);
  const kind = input.kind ?? inferServiceKind(name);

  if (name.length < 2) {
    return { ok: false as const, error: "Informe o nome do serviço." };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false as const, error: "Informe um valor maior que zero." };
  }

  const last = await prisma.tenantService.findFirst({
    where: { tenantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const service = await prisma.tenantService.create({
    data: {
      tenantId,
      name,
      price,
      kind,
      active: true,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidateHotel(user.tenant.slug);
  return { ok: true as const, service: serializeTenantService(service) };
}

export async function updateTenantService(input: {
  id: string;
  name?: string;
  price?: number;
  active?: boolean;
  kind?: ServiceKind;
}) {
  const { tenantId, user } = await requireHotelAdminSession();
  const current = await prisma.tenantService.findFirst({
    where: { id: input.id, tenantId },
  });

  if (!current) {
    return { ok: false as const, error: "Serviço não encontrado." };
  }

  const name = input.name?.trim();
  if (name !== undefined && name.length < 2) {
    return { ok: false as const, error: "Informe o nome do serviço." };
  }

  const price = input.price;
  if (price !== undefined && (!Number.isFinite(price) || price <= 0)) {
    return { ok: false as const, error: "Informe um valor maior que zero." };
  }

  const service = await prisma.tenantService.update({
    where: { id: current.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
    },
  });

  revalidateHotel(user.tenant.slug);
  return { ok: true as const, service: serializeTenantService(service) };
}

export async function deleteTenantService(id: string) {
  const { tenantId, user } = await requireHotelAdminSession();
  const current = await prisma.tenantService.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!current) {
    return { ok: false as const, error: "Serviço não encontrado." };
  }

  await prisma.tenantService.delete({ where: { id: current.id } });
  revalidateHotel(user.tenant.slug);
  return { ok: true as const };
}

const ALLOWED_LOGO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function uploadHotelLogoAction(formData: FormData) {
  const { tenantId, user } = await requireHotelAdminSession();
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Escolha uma imagem do logo." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false as const, error: "O logo deve ter no máximo 4 MB." };
  }
  if (file.type && !ALLOWED_LOGO_TYPES.has(file.type)) {
    return { ok: false as const, error: "Use uma imagem JPG, PNG ou WEBP." };
  }

  let logoUrl: string;
  try {
    logoUrl = await uploadHotelLogo(file, tenantId);
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o logo.",
    };
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { logoUrl },
  });

  revalidateHotel(user.tenant.slug);
  return { ok: true as const, logoUrl };
}

export async function removeHotelLogo() {
  const { tenantId, user } = await requireHotelAdminSession();

  try {
    await deleteHotelLogo(tenantId);
  } catch (error) {
    console.error("[removeHotelLogo]", error);
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { logoUrl: null },
  });

  revalidateHotel(user.tenant.slug);
  return { ok: true as const };
}

export async function removeMercadoPagoToken() {
  const { tenantId } = await requireHotelAdminSession();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { mpAccessTokenEnc: null },
  });
  revalidatePath("/dashboard/configuracoes");
  return { ok: true as const };
}
