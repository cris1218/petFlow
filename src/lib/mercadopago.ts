import { MercadoPagoConfig, Payment } from "mercadopago";

export type PixCharge = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
  mocked: boolean;
};

function mpClient() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return null;
  return new MercadoPagoConfig({ accessToken: token });
}

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

export async function createPixDeposit(input: {
  bookingId: string;
  amount: number;
  description: string;
  payerEmail: string;
}): Promise<PixCharge> {
  const client = mpClient();

  if (!client) {
    return {
      paymentId: `mock_${input.bookingId}`,
      qrCode: `00020126580014BR.GOV.BCB.PIX0136petflow-mock-${input.bookingId}`,
      qrCodeBase64: "",
      mocked: true,
    };
  }

  const payment = new Payment(client);
  const notificationUrl = process.env.APP_URL
    ? `${process.env.APP_URL}/api/webhooks/mercadopago`
    : undefined;

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
    mocked: false,
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  const client = mpClient();
  if (!client) {
    return {
      id: paymentId,
      status: paymentId.startsWith("mock_") ? "approved" : "pending",
      externalReference: paymentId.replace("mock_", ""),
    };
  }

  const payment = new Payment(client);
  const result = await payment.get({ id: paymentId });

  return {
    id: String(result.id),
    status: result.status ?? "pending",
    externalReference: result.external_reference ?? "",
  };
}
