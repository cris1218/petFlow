"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHotelAdminSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";
import { deleteHotelLogo, uploadHotelLogo } from "@/lib/cloudinary";
import {
  FIXED_SERVICES,
  ensureTenantServices,
  serializeTenantService,
} from "@/lib/services";
import {
  TIME_PATTERN,
  WEEKDAY_ORDER,
  isTimedService,
  type WeekdayHours,
} from "@/lib/schedule";
import {
  ensureServiceWeekdays,
  ensureTenantSchedule,
  getTenantScheduleConfig,
} from "@/lib/tenant-schedule";
import { phoneDigits } from "@/lib/utils";

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
    where: {
      tenantId: tenant.id,
      name: { in: FIXED_SERVICES.map((service) => service.name) },
    },
    include: { weekdays: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const schedule = await getTenantScheduleConfig(tenant.id);

  return {
    name: tenant.name,
    slug: tenant.slug,
    whatsappNumber: tenant.whatsappNumber ?? "",
    pixConfigured: Boolean(tenant.mpAccessTokenEnc),
    logoUrl: tenant.logoUrl,
    services: services.map(serializeTenantService),
    schedule,
  };
}

export async function saveHotelWhatsApp(whatsappNumber: string) {
  const { tenantId, user } = await requireHotelAdminSession();
  const digits = phoneDigits(whatsappNumber);

  if (digits && digits.length < 10) {
    return { ok: false as const, error: "Informe um WhatsApp válido." };
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { whatsappNumber: digits || null },
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

function parseWeekdays(weekdays?: WeekdayHours[]) {
  if (!weekdays) return null;
  const byWeekday = new Map(weekdays.map((day) => [day.weekday, day]));
  for (const weekday of WEEKDAY_ORDER) {
    const day = byWeekday.get(weekday);
    if (!day) return { ok: false as const, error: "Informe os horários de todos os dias." };
    if (!day.closed) {
      if (!TIME_PATTERN.test(day.openTime) || !TIME_PATTERN.test(day.closeTime)) {
        return { ok: false as const, error: "Use horários no formato 08:00." };
      }
      if (day.closeTime <= day.openTime) {
        return {
          ok: false as const,
          error: "O horário de fechamento deve ser depois da abertura.",
        };
      }
    }
  }
  return {
    ok: true as const,
    data: WEEKDAY_ORDER.map((weekday) => {
      const day = byWeekday.get(weekday)!;
      return {
        weekday,
        openTime: day.openTime,
        closeTime: day.closeTime,
        closed: day.closed,
      };
    }),
  };
}

type ServiceAgendaInput = {
  dailyCutoffTime?: string;
  depositAmount?: number | null;
  catCapacity?: number;
  dogCapacity?: number;
  periodCapacity?: number;
  slotDurationMin?: number;
  slotCapacity?: number;
  weekdays?: WeekdayHours[];
};

export async function updateTenantService(input: {
  id: string;
  price?: number;
  active?: boolean;
} & ServiceAgendaInput) {
  const { tenantId, user } = await requireHotelAdminSession();
  const current = await prisma.tenantService.findFirst({
    where: { id: input.id, tenantId },
  });

  if (!current) {
    return { ok: false as const, error: "Serviço não encontrado." };
  }

  const price = input.price;
  if (price !== undefined && (!Number.isFinite(price) || price <= 0)) {
    return { ok: false as const, error: "Informe um valor maior que zero." };
  }

  const parsedDays = input.weekdays ? parseWeekdays(input.weekdays) : null;
  if (parsedDays && !parsedDays.ok) return parsedDays;

  const service = await prisma.tenantService.update({
    where: { id: current.id },
    data: {
      ...(price !== undefined ? { price } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.dailyCutoffTime !== undefined
        ? { dailyCutoffTime: input.dailyCutoffTime }
        : {}),
      ...(input.depositAmount !== undefined ? { depositAmount: input.depositAmount } : {}),
      ...(input.catCapacity !== undefined
        ? { catCapacity: Math.max(0, Math.floor(input.catCapacity)) }
        : {}),
      ...(input.dogCapacity !== undefined
        ? { dogCapacity: Math.max(0, Math.floor(input.dogCapacity)) }
        : {}),
      ...(input.periodCapacity !== undefined
        ? { periodCapacity: Math.max(1, Math.floor(input.periodCapacity)) }
        : {}),
      ...(input.slotDurationMin !== undefined
        ? { slotDurationMin: Math.max(15, Math.floor(input.slotDurationMin)) }
        : {}),
      ...(input.slotCapacity !== undefined
        ? { slotCapacity: Math.max(1, Math.floor(input.slotCapacity)) }
        : {}),
      ...(parsedDays?.ok
        ? {
            weekdays: {
              deleteMany: {},
              create: parsedDays.data,
            },
          }
        : {}),
    },
    include: { weekdays: true },
  });

  if (isTimedService(current.kind)) {
    await ensureServiceWeekdays(service.id);
  }

  revalidateHotel(user.tenant.slug);
  const withDays = await prisma.tenantService.findFirst({
    where: { id: service.id },
    include: { weekdays: true },
  });
  return { ok: true as const, service: serializeTenantService(withDays ?? service) };
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
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false as const, error: "O logo deve ter no máximo 2 MB." };
  }
  if (file.type && !ALLOWED_LOGO_TYPES.has(file.type)) {
    return { ok: false as const, error: "Use PNG (fundo transparente), WEBP ou JPG." };
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
