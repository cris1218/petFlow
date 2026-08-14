import { MercadoPagoConfig, Payment } from "mercadopago";
import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";

export type PixCharge = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
};

type TenantMpSource = {
  mpAccessTokenEnc?: string | null;
};

export function resolveMercadoPagoToken(tenant?: TenantMpSource | null) {
  if (tenant?.mpAccessTokenEnc) {
    try {
      return decryptSecret(tenant.mpAccessTokenEnc);
    } catch (error) {
      console.error("[mercadopago] token decrypt failed", error);
    }
  }
  return process.env.MP_ACCESS_TOKEN || null;
}

export function isMercadoPagoConfigured(tenant?: TenantMpSource | null) {
  return Boolean(resolveMercadoPagoToken(tenant));
}

export async function getPlatformMpToken() {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "platform" },
    select: { mpAccessTokenEnc: true },
  });

  if (settings?.mpAccessTokenEnc) {
    try {
      return decryptSecret(settings.mpAccessTokenEnc);
    } catch (error) {
      console.error("[mercadopago] platform token decrypt failed", error);
    }
  }

  return process.env.MP_ACCESS_TOKEN || null;
}

export async function isPlatformMercadoPagoConfigured() {
  return Boolean(await getPlatformMpToken());
}

function mpClient(accessToken: string) {
  return new MercadoPagoConfig({ accessToken });
}

export async function createPixPayment(input: {
  accessToken: string;
  amount: number;
  description: string;
  payerEmail: string;
  payerCpf?: string;
  externalReference: string;
}): Promise<PixCharge> {
  const payment = new Payment(mpClient(input.accessToken));
  const notificationUrl = `${getAppUrl()}/api/webhooks/mercadopago`;

  const result = await payment.create({
    body: {
      transaction_amount: Number(input.amount.toFixed(2)),
      description: input.description,
      payment_method_id: "pix",
      payer: {
        email: input.payerEmail,
        ...(input.payerCpf
          ? { identification: { type: "CPF", number: input.payerCpf } }
          : {}),
      },
      external_reference: input.externalReference,
      notification_url: notificationUrl,
    },
  });

  const tx = result.point_of_interaction?.transaction_data;

  return {
    paymentId: String(result.id),
    qrCode: tx?.qr_code ?? "",
    qrCodeBase64: tx?.qr_code_base64 ?? "",
    ticketUrl: tx?.ticket_url,
  };
}

export async function createPixDeposit(input: {
  accessToken: string;
  bookingId: string;
  amount: number;
  description: string;
  payerEmail: string;
  payerCpf?: string;
}): Promise<PixCharge> {
  return createPixPayment({
    accessToken: input.accessToken,
    amount: input.amount,
    description: input.description,
    payerEmail: input.payerEmail,
    payerCpf: input.payerCpf,
    externalReference: input.bookingId,
  });
}

export async function getMercadoPagoPayment(paymentId: string, accessToken: string) {
  const payment = new Payment(mpClient(accessToken));
  const result = await payment.get({ id: paymentId });

  return {
    id: String(result.id),
    status: result.status ?? "pending",
    externalReference: result.external_reference ?? "",
  };
}

export function subscriptionExternalRef(paymentRowId: string) {
  return `sub:${paymentRowId}`;
}

export function parseSubscriptionExternalRef(reference: string) {
  if (!reference.startsWith("sub:")) return null;
  const id = reference.slice(4).trim();
  return id || null;
}
