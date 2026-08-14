import { NextRequest, NextResponse } from "next/server";
import { addDays, startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppText, whatsappTemplates } from "@/lib/whatsapp";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tomorrow = addDays(new Date(), 1);
  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSent: false,
      startDate: {
        gte: startOfDay(tomorrow),
        lte: endOfDay(tomorrow),
      },
    },
    include: {
      pet: { include: { tutor: true } },
      tenant: true,
    },
  });

  let sent = 0;

  for (const booking of bookings) {
    const instanceName =
      booking.tenant.whatsappInstanceName ??
      `petflow_${slugify(booking.tenant.slug)}`;

    try {
      await sendWhatsAppText({
        instanceName,
        phone: booking.pet.tutor.phone,
        text: whatsappTemplates.reminder({
          tutorName: booking.pet.tutor.name,
          petName: booking.pet.name,
        }),
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSent: true },
      });
      sent += 1;
    } catch (error) {
      console.error("[cron:reminders]", booking.id, error);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: bookings.length,
    sent,
  });
}
