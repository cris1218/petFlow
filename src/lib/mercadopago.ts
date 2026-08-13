import { MercadoPagoConfig, Payment } from "mercadopago";
import { getAppUrl } from "@/lib/app-url";
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

function mpClient(accessToken: string) {
  return new MercadoPagoConfig({ accessToken });
}

export async function createPixDeposit(input: {
  accessToken: string;
  bookingId: string;
  amount: number;
  description: string;
  payerEmail: string;
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
      },
      external_reference: input.bookingId,
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

export async function getMercadoPagoPayment(paymentId: string, accessToken: string) {
  const payment = new Payment(mpClient(accessToken));
  const result = await payment.get({ id: paymentId });

  return {
    id: String(result.id),
    status: result.status ?? "pending",
    externalReference: result.external_reference ?? "",
  };
}
