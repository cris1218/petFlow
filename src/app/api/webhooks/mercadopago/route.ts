import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoPayment,
  resolveMercadoPagoToken,
} from "@/lib/mercadopago";
import { confirmPaidBooking } from "@/actions/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoNotification = {
  type?: string;
  action?: string;
  data?: { id?: string };
};

async function resolveAccessToken(paymentId: string) {
  const byPayment = await prisma.booking.findFirst({
    where: { mpPaymentId: String(paymentId) },
    include: { tenant: true },
  });
  if (byPayment) {
    return {
      token: resolveMercadoPagoToken(byPayment.tenant),
      bookingId: byPayment.id,
    };
  }

  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { mpAccessTokenEnc: { not: null } },
        { status: { not: "SUSPENDED" } },
      ],
    },
    select: { id: true, mpAccessTokenEnc: true },
  });

  for (const tenant of tenants) {
    const token = resolveMercadoPagoToken(tenant);
    if (!token) continue;
    try {
      const payment = await getMercadoPagoPayment(paymentId, token);
      if (payment.externalReference) {
        return { token, bookingId: payment.externalReference };
      }
    } catch {
      continue;
    }
  }

  const fallback = process.env.MP_ACCESS_TOKEN;
  return { token: fallback ?? null, bookingId: null as string | null };
}

async function confirmBookingFromPayment(paymentId: string) {
  const resolved = await resolveAccessToken(paymentId);
  if (!resolved.token) {
    return { processed: false, reason: "no_token" };
  }

  const payment = await getMercadoPagoPayment(paymentId, resolved.token);
  if (payment.status !== "approved") {
    return { processed: false, reason: `status_${payment.status}` };
  }

  const bookingId = resolved.bookingId || payment.externalReference;
  if (!bookingId) {
    return { processed: false, reason: "booking_not_found" };
  }

  const result = await confirmPaidBooking(bookingId);
  if (!result.ok) {
    return { processed: false, reason: "booking_not_found" };
  }

  return { processed: true, reason: "confirmed", bookingId };
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
