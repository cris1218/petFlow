"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import {
  ensureWhatsAppInstance,
  getWhatsAppQr,
} from "@/lib/whatsapp";

export async function getWhatsAppConnection() {
  const { user } = await requireStaffSession();
  const instanceName =
    user.tenant.whatsappInstanceName ?? `petflow_${slugify(user.tenant.slug)}`;

  return {
    instanceName,
    connected: user.tenant.whatsappConnected,
    number: user.tenant.whatsappNumber,
  };
}

export async function pairWhatsApp() {
  const { user, tenantId } = await requireStaffSession();
  const instanceName =
    user.tenant.whatsappInstanceName ?? `petflow_${slugify(user.tenant.slug)}`;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { whatsappInstanceName: instanceName },
  });

  const qr = await ensureWhatsAppInstance(
    instanceName,
    user.tenant.whatsappNumber ?? undefined,
  );

  return {
    ok: true as const,
    instanceName,
    mocked: qr.mocked,
    qrBase64: qr.qrBase64,
    pairingCode: qr.pairingCode,
  };
}

export async function refreshWhatsAppQr() {
  const { user } = await requireStaffSession();
  const instanceName = user.tenant.whatsappInstanceName;

  if (!instanceName) {
    return pairWhatsApp();
  }

  const qr = await getWhatsAppQr(instanceName);
  return {
    ok: true as const,
    instanceName,
    mocked: qr.mocked,
    qrBase64: qr.qrBase64,
    pairingCode: qr.pairingCode,
  };
}

export async function markWhatsAppConnected(connected: boolean) {
  const { tenantId } = await requireStaffSession();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { whatsappConnected: connected },
  });
  return { ok: true as const };
}
