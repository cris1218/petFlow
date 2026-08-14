import { formatBookingWhen, toWhatsAppNumber } from "@/lib/utils";
import { readEnv } from "@/lib/env";

type ConfirmationInput = {
  tutorName: string;
  petName: string;
  startDate: Date;
  endDate: Date;
  slotTime?: string | null;
};

type DailyLogInput = {
  photoUrl: string;
  statusNote: string;
};

type ReminderInput = {
  tutorName: string;
  petName: string;
};

export const whatsappTemplates = {
  confirmation({ tutorName, petName, startDate, endDate, slotTime }: ConfirmationInput) {
    return `Olá ${tutorName}! A reserva do ${petName} (${formatBookingWhen(startDate, endDate, slotTime)}) foi CONFIRMADA! 🐾`;
  },
  dailyLog({ photoUrl, statusNote }: DailyLogInput) {
    return `Olha quem está se divertindo! 📸 ${photoUrl} - Status: ${statusNote}`;
  },
  reminder({ tutorName, petName }: ReminderInput) {
    return `Oi ${tutorName}! Amanhã recebemos o ${petName}. Não esqueça da ração e da carteira de vacinas!`;
  },
};

function evolutionUrl() {
  return readEnv("EVOLUTION_API_URL")?.replace(/\/$/, "") ?? "";
}

function evolutionKey() {
  return readEnv("EVOLUTION_API_KEY") ?? "";
}

function evolutionConfigured() {
  return Boolean(evolutionUrl() && evolutionKey());
}

export function isWhatsAppConfigured() {
  return evolutionConfigured();
}

type EvolutionPayload = {
  base64?: string;
  code?: string;
  pairingCode?: string;
  count?: number;
  qrcode?: { base64?: string; code?: string; pairingCode?: string };
  instance?: { status?: string; state?: string; instanceName?: string };
};

type EvolutionResult = {
  ok: boolean;
  status: number;
  mocked: boolean;
  data: EvolutionPayload | null;
};

function extractQr(data: EvolutionPayload | null) {
  const qrBase64 = data?.base64 ?? data?.qrcode?.base64 ?? null;
  const pairingCode =
    data?.pairingCode ??
    data?.qrcode?.pairingCode ??
    (data?.code && !String(data.code).startsWith("2@") ? data.code : null) ??
    data?.qrcode?.code ??
    null;

  return {
    qrBase64: qrBase64 || null,
    pairingCode: pairingCode || null,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evolutionRequest(path: string, init?: RequestInit): Promise<EvolutionResult> {
  if (!evolutionConfigured()) {
    console.info("[whatsapp:mock]", path, init?.body);
    return { ok: true, status: 200, mocked: true, data: null };
  }

  let response: Response;
  try {
    response = await fetch(`${evolutionUrl()}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey(),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "falha de rede";
    throw new Error(`Não foi possível alcançar a Evolution API (${evolutionUrl()}): ${detail}`);
  }

  const data = (await response.json().catch(() => null)) as EvolutionPayload | null;
  return { ok: response.ok, status: response.status, mocked: false, data };
}

async function evolutionFetch(path: string, init?: RequestInit) {
  const result = await evolutionRequest(path, init);
  if (!result.ok && !result.mocked) {
    throw new Error(`Evolution API ${result.status}: ${JSON.stringify(result.data)}`);
  }
  return result;
}

function isMissingInstance(result: EvolutionResult) {
  const payload = JSON.stringify(result.data ?? "");
  return result.status === 404 || /does not exist/i.test(payload);
}

export async function getWhatsAppQr(instanceName: string) {
  const result = await evolutionRequest(`/instance/connect/${instanceName}`);
  if (result.mocked) {
    return { mocked: true, missing: false, qrBase64: null, pairingCode: null };
  }
  if (isMissingInstance(result)) {
    return { mocked: false, missing: true, qrBase64: null, pairingCode: null };
  }
  if (!result.ok) {
    throw new Error(`Evolution API ${result.status}: ${JSON.stringify(result.data)}`);
  }
  return { mocked: false, missing: false, ...extractQr(result.data) };
}

function instanceNameOf(item: unknown) {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  if (typeof record.name === "string") return record.name;
  if (typeof record.instanceName === "string") return record.instanceName;
  const nested = record.instance;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    if (typeof inner.instanceName === "string") return inner.instanceName;
    if (typeof inner.name === "string") return inner.name;
  }
  return null;
}

async function instanceExists(instanceName: string) {
  try {
    const result = await evolutionRequest("/instance/fetchInstances");
    const raw = result.data as unknown;
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as { instance?: unknown }).instance)
        ? ((raw as { instance: unknown[] }).instance)
        : [];
    return list.some((item) => instanceNameOf(item) === instanceName);
  } catch {
    return false;
  }
}

async function getConnectionState(instanceName: string) {
  const result = await evolutionRequest(`/instance/connectionState/${instanceName}`);
  if (isMissingInstance(result)) return null;
  return result.data?.instance?.state ?? result.data?.instance?.status ?? null;
}

export async function getWhatsAppConnectionState(instanceName: string) {
  return getConnectionState(instanceName);
}

async function logoutInstance(instanceName: string) {
  const deleted = await evolutionRequest(`/instance/logout/${instanceName}`, {
    method: "DELETE",
  });
  if (deleted.ok || isMissingInstance(deleted)) return;
  await evolutionRequest(`/instance/logout/${instanceName}`, { method: "PUT" });
}

async function restartInstance(instanceName: string) {
  const put = await evolutionRequest(`/instance/restart/${instanceName}`, {
    method: "PUT",
  });
  if (put.ok) return;
  await evolutionRequest(`/instance/restart/${instanceName}`, { method: "POST" });
}

async function createInstance(instanceName: string) {
  return evolutionRequest("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });
}

async function pollQr(instanceName: string, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await sleep(800);
    const qr = await getWhatsAppQr(instanceName);
    if (qr.qrBase64) return qr;
    if (qr.missing) break;
  }
  return getWhatsAppQr(instanceName);
}

export async function ensureWhatsAppInstance(instanceName: string) {
  const exists = await instanceExists(instanceName);

  if (!exists) {
    const created = await createInstance(instanceName);
    if (!created.ok && !/already|exist/i.test(JSON.stringify(created.data ?? ""))) {
      throw new Error(`Evolution API ${created.status}: ${JSON.stringify(created.data)}`);
    }
    const fromCreate = extractQr(created.data);
    if (fromCreate.qrBase64) {
      return { mocked: false, missing: false, ...fromCreate };
    }
    return pollQr(instanceName);
  }

  const state = await getConnectionState(instanceName);

  if (state === "open") {
    return { mocked: false, missing: false, qrBase64: null, pairingCode: null };
  }

  // connecting + QR vazio, ou instância só no banco (404 no waMonitor):
  // logout/restart tira do estado preso sem apagar a instância.
  if (!state) {
    await restartInstance(instanceName);
  } else {
    await logoutInstance(instanceName);
  }

  await sleep(800);
  const qr = await getWhatsAppQr(instanceName);
  if (qr.qrBase64) return qr;
  if (qr.missing) {
    await restartInstance(instanceName);
    await sleep(800);
  }
  return pollQr(instanceName);
}

export async function deleteWhatsAppInstance(instanceName: string) {
  await evolutionRequest(`/instance/delete/${instanceName}`, {
    method: "DELETE",
  });
}

export async function sendWhatsAppText(input: {
  instanceName: string;
  phone: string;
  text: string;
}) {
  return evolutionFetch(`/message/sendText/${input.instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      number: toWhatsAppNumber(input.phone),
      text: input.text,
    }),
  });
}

export async function sendWhatsAppImage(input: {
  instanceName: string;
  phone: string;
  imageUrl: string;
  caption: string;
}) {
  return evolutionFetch(`/message/sendMedia/${input.instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      number: toWhatsAppNumber(input.phone),
      mediatype: "image",
      media: input.imageUrl,
      caption: input.caption,
    }),
  });
}
