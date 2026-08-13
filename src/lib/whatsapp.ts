import { formatDate, toWhatsAppNumber } from "@/lib/utils";

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

function evolutionConfigured() {
  return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
}

export function isWhatsAppConfigured() {
  return evolutionConfigured();
}

async function evolutionFetch(path: string, init?: RequestInit) {
  if (!evolutionConfigured()) {
    console.info("[whatsapp:mock]", path, init?.body);
    return { ok: true, mocked: true, data: null as unknown };
  }

  const base = process.env.EVOLUTION_API_URL!.replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.EVOLUTION_API_KEY!,
      ...init?.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Evolution API ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return { ok: true, mocked: false, data };
}

export async function connectWhatsAppInstance(instanceName: string) {
  return evolutionFetch(`/instance/connect/${instanceName}`);
}

export async function getWhatsAppQr(instanceName: string) {
  const result = await evolutionFetch(`/instance/connect/${instanceName}`);
  const data = result.data as {
    base64?: string;
    code?: string;
    qrcode?: { base64?: string };
  } | null;

  return {
    mocked: result.mocked,
    qrBase64: data?.base64 ?? data?.qrcode?.base64 ?? null,
    pairingCode: data?.code ?? null,
  };
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
    if (!message.includes("already") && !message.includes("409")) {
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
