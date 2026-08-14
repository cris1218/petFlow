import { prisma } from "@/lib/prisma";
import {
  sendWhatsAppImage,
  sendWhatsAppText,
  whatsappTemplates,
} from "@/lib/whatsapp";

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

export async function dispatchDailyLog(logId: string) {
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
