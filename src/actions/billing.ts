"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterSession, requireStaffSession } from "@/lib/auth";
import { getBillingState, nextPaidUntil } from "@/lib/billing";
import {
  createPixPayment,
  getMercadoPagoPayment,
  getPlatformMpToken,
  parseSubscriptionExternalRef,
  subscriptionExternalRef,
} from "@/lib/mercadopago";

const PIX_REUSE_MS = 20 * 60 * 60 * 1000;

function revalidateBilling(tenantId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/plano");
  revalidatePath("/admin");
  revalidatePath(`/admin/hoteis/${tenantId}`);
}

async function applyApprovedSubscription(input: {
  paymentRowId: string;
  mpPaymentId: string;
}) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: input.paymentRowId },
    include: {
      tenant: {
        select: {
          id: true,
          createdAt: true,
          billingPaidUntil: true,
          status: true,
        },
      },
    },
  });

  if (!payment) {
    return { ok: false as const, error: "Pagamento não encontrado." };
  }

  if (payment.status === "PAID") {
    return {
      ok: true as const,
      alreadyPaid: true,
      paidUntil: payment.tenant.billingPaidUntil,
    };
  }

  const paidUntil = nextPaidUntil(
    payment.tenant.createdAt,
    payment.tenant.billingPaidUntil,
  );

  const claimed = await prisma.subscriptionPayment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: {
      status: "PAID",
      paidAt: new Date(),
      mpPaymentId: input.mpPaymentId,
    },
  });

  if (claimed.count === 0) {
    const latest = await prisma.tenant.findUnique({
      where: { id: payment.tenantId },
      select: { billingPaidUntil: true },
    });
    return {
      ok: true as const,
      alreadyPaid: true,
      paidUntil: latest?.billingPaidUntil ?? null,
    };
  }

  await prisma.tenant.update({
    where: { id: payment.tenantId },
    data: {
      billingPaidUntil: paidUntil,
      status: payment.tenant.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
    },
  });

  revalidateBilling(payment.tenantId);
  return { ok: true as const, alreadyPaid: false, paidUntil };
}

export async function confirmPaidSubscription(mpPaymentId: string) {
  const token = await getPlatformMpToken();
  if (!token) {
    return { ok: false as const, error: "Mercado Pago da plataforma não configurado." };
  }

  const mp = await getMercadoPagoPayment(mpPaymentId, token);
  if (mp.status !== "approved") {
    return { ok: false as const, error: `status_${mp.status}` };
  }

  const byMpId = await prisma.subscriptionPayment.findUnique({
    where: { mpPaymentId: String(mpPaymentId) },
    select: { id: true },
  });
  const fromRef = parseSubscriptionExternalRef(mp.externalReference);
  const paymentRowId = byMpId?.id ?? fromRef;

  if (!paymentRowId) {
    return { ok: false as const, error: "Pagamento de plano não encontrado." };
  }

  return applyApprovedSubscription({
    paymentRowId,
    mpPaymentId: String(mpPaymentId),
  });
}

async function verifyMpPaymentRow(paymentRowId: string) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentRowId },
    select: { id: true, mpPaymentId: true, status: true, tenantId: true },
  });

  if (!payment?.mpPaymentId) {
    return { ok: false as const, error: "PIX ainda não foi gerado." };
  }

  if (payment.status === "PAID") {
    const tenant = await prisma.tenant.findUnique({
      where: { id: payment.tenantId },
      select: { billingPaidUntil: true },
    });
    return {
      ok: true as const,
      paid: true,
      paidUntil: tenant?.billingPaidUntil ?? null,
    };
  }

  const token = await getPlatformMpToken();
  if (!token) {
    return { ok: false as const, error: "Mercado Pago da plataforma não configurado." };
  }

  const mp = await getMercadoPagoPayment(payment.mpPaymentId, token);
  if (mp.status !== "approved") {
    return {
      ok: true as const,
      paid: false,
      status: mp.status,
    };
  }

  const applied = await applyApprovedSubscription({
    paymentRowId: payment.id,
    mpPaymentId: payment.mpPaymentId,
  });

  if (!applied.ok) {
    return applied;
  }

  return {
    ok: true as const,
    paid: true,
    paidUntil: applied.paidUntil,
  };
}

export async function getHotelBillingOverview() {
  const { user } = await requireStaffSession();
  const userCount = await prisma.user.count({
    where: { tenantId: user.tenant.id },
  });
  const billing = getBillingState(
    user.tenant.createdAt,
    userCount,
    user.tenant.billingPaidUntil,
  );
  const pending = await prisma.subscriptionPayment.findFirst({
    where: { tenantId: user.tenant.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  const pixConfigured = Boolean(await getPlatformMpToken());

  return {
    hotelName: user.tenant.name,
    pixConfigured,
    billing,
    pending: pending
      ? {
          id: pending.id,
          amount: Number(pending.amount),
          qrCode: pending.qrCode,
          qrCodeBase64: pending.qrCodeBase64,
          createdAt: pending.createdAt,
        }
      : null,
  };
}

export async function createSubscriptionPix() {
  const { user } = await requireStaffSession();
  const token = await getPlatformMpToken();
  if (!token) {
    return {
      ok: false as const,
      error: "O PIX da plataforma ainda não foi configurado. Fale com o suporte.",
    };
  }

  const userCount = await prisma.user.count({
    where: { tenantId: user.tenant.id },
  });
  const billing = getBillingState(
    user.tenant.createdAt,
    userCount,
    user.tenant.billingPaidUntil,
  );
  const amount = Number(billing.pixAmount.toFixed(2));

  if (amount < 0.01) {
    return { ok: false as const, error: "Valor do plano inválido." };
  }

  const reusable = await prisma.subscriptionPayment.findFirst({
    where: {
      tenantId: user.tenant.id,
      status: "PENDING",
      amount,
      mpPaymentId: { not: null },
      createdAt: { gte: new Date(Date.now() - PIX_REUSE_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (reusable?.qrCode) {
    return {
      ok: true as const,
      paymentId: reusable.id,
      amount,
      qrCode: reusable.qrCode,
      qrCodeBase64: reusable.qrCodeBase64 ?? "",
    };
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId: user.tenant.id,
      amount,
      daysGranted: 30,
    },
  });

  try {
    const pix = await createPixPayment({
      accessToken: token,
      amount,
      description: `PetFlow — ${user.tenant.name} — 30 dias`,
      payerEmail: user.email,
      externalReference: subscriptionExternalRef(payment.id),
    });

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        mpPaymentId: pix.paymentId,
        qrCode: pix.qrCode,
        qrCodeBase64: pix.qrCodeBase64,
      },
    });

    revalidatePath("/dashboard/plano");
    return {
      ok: true as const,
      paymentId: payment.id,
      amount,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
    };
  } catch (error) {
    console.error("[createSubscriptionPix]", error);
    await prisma.subscriptionPayment.delete({ where: { id: payment.id } }).catch(() => {});
    return {
      ok: false as const,
      error: "Não foi possível gerar o PIX. Tente de novo em instantes.",
    };
  }
}

export async function verifySubscriptionPix() {
  const { user } = await requireStaffSession();
  const pending = await prisma.subscriptionPayment.findFirst({
    where: { tenantId: user.tenant.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!pending) {
    const latestPaid = await prisma.subscriptionPayment.findFirst({
      where: { tenantId: user.tenant.id, status: "PAID" },
      orderBy: { paidAt: "desc" },
    });
    if (latestPaid) {
      return {
        ok: true as const,
        paid: true,
        paidUntil: user.tenant.billingPaidUntil,
      };
    }
    return { ok: false as const, error: "Nenhum PIX pendente para verificar." };
  }

  return verifyMpPaymentRow(pending.id);
}

export async function getSubscriptionPaymentStatus(paymentRowId: string) {
  const { tenantId } = await requireStaffSession();
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: paymentRowId, tenantId },
    select: { id: true, status: true, tenant: { select: { billingPaidUntil: true } } },
  });

  if (!payment) {
    return { ok: false as const, error: "Pagamento não encontrado." };
  }

  return {
    ok: true as const,
    paid: payment.status === "PAID",
    paidUntil: payment.tenant.billingPaidUntil,
  };
}

export async function verifyHotelSubscriptionPix(tenantId: string) {
  await requireMasterSession();

  const pending = await prisma.subscriptionPayment.findFirst({
    where: { tenantId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!pending) {
    return { ok: false as const, error: "Este hotel não tem PIX pendente." };
  }

  const result = await verifyMpPaymentRow(pending.id);
  if (result.ok && "paid" in result && result.paid) {
    revalidatePath("/admin");
  }
  return result;
}
