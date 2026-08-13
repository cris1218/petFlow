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
  try {
    const { user, tenantId } = await requireStaffSession();
    const instanceName =
      user.tenant.whatsappInstanceName ?? `petflow_${slugify(user.tenant.slug)}`;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { whatsappInstanceName: instanceName },
    });

    const qr = await ensureWhatsAppInstance(instanceName);

    return {
      ok: true as const,
      instanceName,
      mocked: qr.mocked,
      qrBase64: qr.qrBase64,
      pairingCode: qr.pairingCode,
    };
  } catch (error) {
    console.error("[pairWhatsApp]", error);
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o QR Code.",
    };
  }
}

export async function refreshWhatsAppQr() {
  try {
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
  } catch (error) {
    console.error("[refreshWhatsAppQr]", error);
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o QR Code.",
    };
  }
}

export async function markWhatsAppConnected(connected: boolean) {
  const { tenantId } = await requireStaffSession();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { whatsappConnected: connected },
  });
  return { ok: true as const };
}
