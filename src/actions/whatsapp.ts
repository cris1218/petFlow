"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import {
  ensureWhatsAppInstance,
  getWhatsAppConnectionState,
  getWhatsAppQr,
} from "@/lib/whatsapp";

async function syncConnected(tenantId: string, instanceName: string) {
  const state = await getWhatsAppConnectionState(instanceName);
  const connected = state === "open";
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { whatsappConnected: connected },
  });
  return connected;
}

export async function getWhatsAppConnection() {
  const { user, tenantId } = await requireStaffSession();
  const instanceName =
    user.tenant.whatsappInstanceName ?? `petflow_${slugify(user.tenant.slug)}`;

  let connected = user.tenant.whatsappConnected;
  if (user.tenant.whatsappInstanceName) {
    connected = await syncConnected(tenantId, instanceName);
  }

  return {
    instanceName,
    connected,
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
    const connected = await syncConnected(tenantId, instanceName);

    return {
      ok: true as const,
      instanceName,
      mocked: qr.mocked,
      qrBase64: connected ? null : qr.qrBase64,
      pairingCode: qr.pairingCode,
      missing: qr.missing,
      connected,
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
    const { user, tenantId } = await requireStaffSession();
    const instanceName = user.tenant.whatsappInstanceName;

    if (!instanceName) {
      return pairWhatsApp();
    }

    const connected = await syncConnected(tenantId, instanceName);
    if (connected) {
      return {
        ok: true as const,
        instanceName,
        mocked: false,
        qrBase64: null,
        pairingCode: null,
        missing: false,
        connected: true,
      };
    }

    const qr = await getWhatsAppQr(instanceName);
    if (qr.missing) {
      return pairWhatsApp();
    }
    return {
      ok: true as const,
      instanceName,
      mocked: qr.mocked,
      qrBase64: qr.qrBase64,
      pairingCode: qr.pairingCode,
      missing: false,
      connected: false,
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
