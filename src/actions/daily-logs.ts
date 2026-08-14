"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { assertOwnedBooking } from "@/lib/tenant";
import { uploadDailyLogPhoto } from "@/lib/cloudinary";
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

export async function createDailyLog(formData: FormData) {
  const { tenantId, user } = await requireStaffSession();

  const bookingId = String(formData.get("bookingId") ?? "");
  const statusNote = String(formData.get("statusNote") ?? "").trim();
  const photo = formData.get("photo");

  if (!bookingId || !statusNote) {
    return {
      ok: false as const,
      error: "Selecione o pet e uma frase de status.",
    };
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
      sentToWhatsApp: false,
    },
  });

  const caption = whatsappTemplates.dailyLog({ statusNote });
  const instanceName =
    user.tenant.whatsappInstanceName ?? `petflow_${user.tenant.slug}`;
  const phone = booking.pet.tutor.phone;
  const media = await imageUrlToWhatsAppMedia(photoUrl);

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
        media: photoUrl,
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

  if (sentToWhatsApp) {
    await prisma.dailyLog.update({
      where: { id: log.id },
      data: { sentToWhatsApp: true },
    });
  }

  revalidatePath("/dashboard/daily-logs");
  revalidatePath("/dashboard");

  return {
    ok: true as const,
    logId: log.id,
    photoUrl,
    sentToWhatsApp,
  };
}

export async function getCheckedInStays() {
  const { tenantId } = await requireStaffSession();

  const bookings = await prisma.booking.findMany({
    where: { tenantId, status: "CHECKED_IN" },
    include: {
      pet: { include: { tutor: true } },
      dailyLogs: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: { startDate: "asc" },
  });

  return bookings.map((booking) => ({
    bookingId: booking.id,
    petName: booking.pet.name,
    species: booking.pet.species,
    tutorName: booking.pet.tutor.name,
    tutorPhone: booking.pet.tutor.phone,
    recentLogs: booking.dailyLogs.map((log) => ({
      id: log.id,
      photoUrl: log.photoUrl,
      statusNote: log.statusNote,
      sentToWhatsApp: log.sentToWhatsApp,
      createdAt: log.createdAt,
    })),
  }));
}
