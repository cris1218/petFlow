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
  qrcode?: { base64?: string; code?: string };
  instance?: { status?: string };
};

function extractQr(data: EvolutionPayload | null) {
  const qrBase64 = data?.base64 ?? data?.qrcode?.base64 ?? null;
  return {
    qrBase64,
    pairingCode: data?.pairingCode ?? data?.code ?? data?.qrcode?.code ?? null,
  };
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
  try {
    const result = await evolutionFetch(`/instance/connect/${instanceName}`);
    const qr = extractQr(result.data);
    return { mocked: result.mocked, ...qr };
  } catch {
    const result = await evolutionFetch(`/instance/qrcode/${instanceName}`);
    const qr = extractQr(result.data);
    return { mocked: result.mocked, ...qr };
  }
}

export async function ensureWhatsAppInstance(instanceName: string, number?: string) {
  try {
    await evolutionFetch("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        number,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/already|exist|409|403/i.test(message)) {
      throw error;
    }
  }

  return getWhatsAppQr(instanceName);
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
