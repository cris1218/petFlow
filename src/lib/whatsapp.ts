import { formatDate, toWhatsAppNumber } from "@/lib/utils";
import { readEnv } from "@/lib/env";

type ConfirmationInput = {
  tutorName: string;
  petName: string;
  startDate: Date;
  endDate: Date;
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
  confirmation({ tutorName, petName, startDate, endDate }: ConfirmationInput) {
    return `Olá ${tutorName}! A reserva do ${petName} de ${formatDate(startDate)} a ${formatDate(endDate)} foi CONFIRMADA! 🐾`;
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

async function evolutionFetch(path: string, init?: RequestInit) {
  if (!evolutionConfigured()) {
    console.info("[whatsapp:mock]", path, init?.body);
    return { ok: true, mocked: true, data: null as EvolutionPayload | null };
  }

  let response: Response;
  try {
    response = await fetch(`${evolutionUrl()}${path}`, {
      ...init,
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

  if (!response.ok) {
    throw new Error(
      `Evolution API ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return { ok: true, mocked: false, data };
}

export async function getWhatsAppQr(instanceName: string) {
  const result = await evolutionFetch(`/instance/connect/${instanceName}`);
  return { mocked: result.mocked, ...extractQr(result.data) };
}

async function deleteInstance(instanceName: string) {
  try {
    await evolutionFetch(`/instance/delete/${instanceName}`, { method: "DELETE" });
  } catch {
    // instância pode não existir
  }
}

export async function ensureWhatsAppInstance(instanceName: string) {
  await deleteInstance(instanceName);

  const created = await evolutionFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });

  const fromCreate = extractQr(created.data);
  if (fromCreate.qrBase64) {
    return { mocked: false, ...fromCreate };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await sleep(800);
    const qr = await getWhatsAppQr(instanceName);
    if (qr.qrBase64) return qr;
  }

  return {
    mocked: false,
    qrBase64: null,
    pairingCode: null,
  };
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
