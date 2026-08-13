import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMercadoPagoPayment } from "@/lib/mercadopago";
import {
  sendWhatsAppText,
  whatsappTemplates,
} from "@/lib/whatsapp";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoNotification = {
  type?: string;
  action?: string;
  data?: { id?: string };
};

async function confirmBookingFromPayment(paymentId: string) {
  const payment = await getMercadoPagoPayment(paymentId);

  if (payment.status !== "approved") {
    return { processed: false, reason: `status_${payment.status}` };
  }

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { mpPaymentId: String(payment.id) },
        ...(payment.externalReference
          ? [{ id: payment.externalReference }]
          : []),
      ],
    },
    include: {
      pet: { include: { tutor: true } },
      tenant: true,
    },
  });

  if (!booking) {
    return { processed: false, reason: "booking_not_found" };
  }

  if (booking.paymentStatus === "PAID" && booking.status !== "PENDING") {
    return { processed: true, reason: "already_confirmed", bookingId: booking.id };
  }

  const updated = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      paymentStatus: "PENDING",
    },
    data: {
      paymentStatus: "PAID",
      status: "CONFIRMED",
      mpPaymentId: String(payment.id),
    },
  });

  if (updated.count === 0) {
    return { processed: true, reason: "already_confirmed", bookingId: booking.id };
  }

  const instanceName =
    booking.tenant.whatsappInstanceName ??
    `petflow_${slugify(booking.tenant.slug)}`;

  try {
    await sendWhatsAppText({
      instanceName,
      phone: booking.pet.tutor.phone,
      text: whatsappTemplates.confirmation({
        tutorName: booking.pet.tutor.name,
        petName: booking.pet.name,
        startDate: booking.startDate,
        endDate: booking.endDate,
      }),
    });
  } catch (error) {
    console.error("[mercadopago-webhook] whatsapp failed", error);
  }

  return { processed: true, reason: "confirmed", bookingId: booking.id };
}

function extractPaymentId(request: NextRequest, body: MercadoPagoNotification) {
  const queryId =
    request.nextUrl.searchParams.get("data.id") ??
    request.nextUrl.searchParams.get("id");
  const queryTopic =
    request.nextUrl.searchParams.get("type") ??
    request.nextUrl.searchParams.get("topic");

  if (queryId && (queryTopic === "payment" || !queryTopic)) {
    return queryId;
  }

  if ((body.type === "payment" || body.action?.includes("payment")) && body.data?.id) {
    return body.data.id;
  }

  return queryId;
}

export async function POST(request: NextRequest) {
  let body: MercadoPagoNotification = {};

  try {
    body = (await request.json()) as MercadoPagoNotification;
  } catch {
    body = {};
  }

  const paymentId = extractPaymentId(request, body);

  if (!paymentId) {
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  try {
    const result = await confirmBookingFromPayment(paymentId);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("[mercadopago-webhook]", error);
    return NextResponse.json(
      { received: true, error: "processing_failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
