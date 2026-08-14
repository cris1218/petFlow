"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { assertOwnedBooking } from "@/lib/tenant";
import { uploadDailyLogPhoto } from "@/lib/cloudinary";
import { TIME_PATTERN } from "@/lib/schedule";
import {
  sendWhatsAppImage,
  sendWhatsAppText,
  whatsappTemplates,
} from "@/lib/whatsapp";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

function scheduledAtFromParts(dateKey: string, time: string) {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  if (!TIME_PATTERN.test(hhmm)) return null;
  const scheduled = new Date(`${dateKey}T${hhmm}:00-03:00`);
  if (Number.isNaN(scheduled.getTime())) return null;
  return scheduled;
}

async function imageUrlToWhatsAppMedia(url: string) {
  const fallback = {
    dataUri: url,
    mimetype: "image/jpeg",
    fileName: "diario.jpg",
  };

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return fallback;
    const mime = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer());
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    return {
      dataUri: `data:${mime};base64,${bytes.toString("base64")}`,
      mimetype: mime.startsWith("image/") ? mime : "image/jpeg",
      fileName: `diario.${ext}`,
    };
  } catch (error) {
    console.error("[daily-log] fetch photo", error);
    return fallback;
  }
}

async function dispatchDailyLog(logId: string) {
  const log = await prisma.dailyLog.findUnique({
    where: { id: logId },
    include: {
      tenant: true,
      booking: { include: { pet: { include: { tutor: true } } } },
    },
  });

  if (!log || log.sentToWhatsApp) {
    return { ok: false as const, error: "Esse envio não está na fila." };
  }

  const caption = whatsappTemplates.dailyLog({ statusNote: log.statusNote });
  const instanceName =
    log.tenant.whatsappInstanceName ?? `petflow_${log.tenant.slug}`;
  const phone = log.booking.pet.tutor.phone;
  const media = await imageUrlToWhatsAppMedia(log.photoUrl);

  let sentToWhatsApp = false;
  try {
    await sendWhatsAppImage({
      instanceName,
      phone,
      media: media.dataUri,
      mimetype: media.mimetype,
      fileName: media.fileName,
      caption,
    });
    sentToWhatsApp = true;
  } catch (error) {
    console.error("[daily-log] whatsapp image", error);
    try {
      await sendWhatsAppImage({
        instanceName,
        phone,
        media: log.photoUrl,
        mimetype: media.mimetype,
        fileName: media.fileName,
        caption,
      });
      sentToWhatsApp = true;
    } catch (urlError) {
      console.error("[daily-log] whatsapp image url", urlError);
      try {
        await sendWhatsAppText({
          instanceName,
          phone,
          text: caption,
        });
        sentToWhatsApp = true;
      } catch (textError) {
        console.error("[daily-log] whatsapp failed", textError);
      }
    }
  }

  if (!sentToWhatsApp) {
    return { ok: false as const, error: "Não foi possível enviar no WhatsApp." };
  }

  await prisma.dailyLog.update({
    where: { id: log.id },
    data: { sentToWhatsApp: true, sentAt: new Date() },
  });

  return { ok: true as const };
}

export async function processDueDailyLogs(tenantId?: string) {
  const due = await prisma.dailyLog.findMany({
    where: {
      sentToWhatsApp: false,
      scheduledAt: { lte: new Date() },
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
    take: 15,
  });

  let sent = 0;
  for (const log of due) {
    const result = await dispatchDailyLog(log.id);
    if (result.ok) sent += 1;
  }
  return { candidates: due.length, sent };
}

export async function createDailyLog(formData: FormData) {
  const { tenantId } = await requireStaffSession();

  const bookingId = String(formData.get("bookingId") ?? "");
  const statusNote = String(formData.get("statusNote") ?? "").trim();
  const scheduledDate = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "");
  const photo = formData.get("photo");

  if (!bookingId || !statusNote) {
    return {
      ok: false as const,
      error: "Selecione o pet e uma frase de status.",
    };
  }

  const scheduledAt = scheduledAtFromParts(scheduledDate, scheduledTime);
  if (!scheduledAt) {
    return { ok: false as const, error: "Informe a data e o horário do envio." };
  }

  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false as const, error: "Envie uma foto do pet." };
  }

  if (photo.size > 8 * 1024 * 1024) {
    return { ok: false as const, error: "A foto deve ter no máximo 8 MB." };
  }

  if (photo.type && !ALLOWED_IMAGE_TYPES.has(photo.type)) {
    return {
      ok: false as const,
      error: "Use uma imagem JPG, PNG ou WEBP.",
    };
  }

  const booking = await assertOwnedBooking(tenantId, bookingId);

  if (booking.status !== "CHECKED_IN") {
    return {
      ok: false as const,
      error: "O diário só pode ser enviado para pets que já deram entrada.",
    };
  }

  let photoUrl: string;
  try {
    photoUrl = await uploadDailyLogPhoto(photo);
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a foto.",
    };
  }

  const log = await prisma.dailyLog.create({
    data: {
      tenantId,
      bookingId: booking.id,
      photoUrl,
      statusNote,
      scheduledAt,
      sentToWhatsApp: false,
    },
  });

  revalidatePath("/dashboard/daily-logs");
  revalidatePath("/dashboard");

  return {
    ok: true as const,
    logId: log.id,
    photoUrl,
    scheduledAt,
  };
}

export async function sendQueuedDailyLog(logId: string) {
  const { tenantId } = await requireStaffSession();
  const log = await prisma.dailyLog.findFirst({
    where: { id: logId, tenantId, sentToWhatsApp: false },
    select: { id: true },
  });
  if (!log) {
    return { ok: false as const, error: "Esse envio não está na fila." };
  }

  const result = await dispatchDailyLog(log.id);
  revalidatePath("/dashboard/daily-logs");
  revalidatePath("/dashboard");
  return result;
}

export async function removeQueuedDailyLog(logId: string) {
  const { tenantId } = await requireStaffSession();
  const log = await prisma.dailyLog.findFirst({
    where: { id: logId, tenantId, sentToWhatsApp: false },
    select: { id: true },
  });
  if (!log) {
    return { ok: false as const, error: "Esse envio não está na fila." };
  }

  await prisma.dailyLog.delete({ where: { id: log.id } });
  revalidatePath("/dashboard/daily-logs");
  return { ok: true as const };
}

export async function getDailyLogsPageData() {
  const { tenantId } = await requireStaffSession();
  await processDueDailyLogs(tenantId);

  const [bookings, queued] = await Promise.all([
    prisma.booking.findMany({
      where: { tenantId, status: "CHECKED_IN" },
      include: {
        pet: { include: { tutor: true } },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.dailyLog.findMany({
      where: { tenantId, sentToWhatsApp: false },
      include: {
        booking: { include: { pet: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  return {
    stays: bookings.map((booking) => ({
      bookingId: booking.id,
      petName: booking.pet.name,
      species: booking.pet.species,
      tutorName: booking.pet.tutor.name,
      tutorPhone: booking.pet.tutor.phone,
    })),
    queue: queued.map((log) => ({
      id: log.id,
      photoUrl: log.photoUrl,
      statusNote: log.statusNote,
      scheduledAt: log.scheduledAt,
      petName: log.booking.pet.name,
    })),
  };
}
