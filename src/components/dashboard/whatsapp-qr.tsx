"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markWhatsAppConnected,
  pairWhatsApp,
  refreshWhatsAppQr,
} from "@/actions/whatsapp";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/app-feedback";
import { formatWhatsAppMask } from "@/lib/utils";

export function WhatsAppQrCard({
  number,
}: {
  connected: boolean;
  number: string | null;
  instanceName: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [mocked, setMocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { success } = useFeedback();

  async function requestQr(refresh: boolean): Promise<"qr" | "wait" | "error" | "connected"> {
    const result = refresh ? await refreshWhatsAppQr() : await pairWhatsApp();
    if (!result.ok) {
      setError(result.error ?? "Não foi possível gerar o QR Code.");
      setStatus(null);
      return "error";
    }
    if ("connected" in result && result.connected) {
      setStatus("WhatsApp conectado.");
      setQr(null);
      success("WhatsApp conectado com sucesso.");
      return "connected";
    }
    setMocked(result.mocked);
    if (result.qrBase64) {
      setQr(result.qrBase64);
      setStatus(null);
      return "qr";
    }
    setStatus("A Evolution está gerando o QR. Tentando de novo…");
    return "wait";
  }

  function loadQr(refresh = false) {
    startTransition(async () => {
      setError(null);
      const first = await requestQr(refresh);
      if (first === "connected") {
        router.refresh();
        return;
      }
      if (first !== "wait") return;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const next = await requestQr(true);
        if (next === "connected") {
          router.refresh();
          return;
        }
        if (next !== "wait") return;
      }

      setError(
        "O QR ainda não apareceu. Toque em Gerar QR Code de novo.",
      );
      setStatus(null);
    });
  }

  return (
    <div className="space-y-4">
      {number ? (
        <p className="text-sm text-muted-foreground">
          Número ligado: {formatWhatsAppMask(number)}
        </p>
      ) : null}
      <div className="mx-auto flex aspect-square w-full max-w-xs items-center justify-center rounded-xl border bg-muted p-4">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
            alt="QR Code WhatsApp"
            className="h-full w-full object-contain"
          />
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {status ??
              (mocked
                ? "O WhatsApp ainda não está pronto neste ambiente."
                : "Toque em Gerar QR Code. Depois abra o WhatsApp do hotel e aponte a câmera.")}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button className="w-full sm:w-auto" onClick={() => loadQr(false)} loading={isPending}>
          {isPending ? "Gerando..." : "Gerar QR Code"}
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          onClick={() => loadQr(true)}
          loading={isPending}
        >
          Atualizar
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="secondary"
          loading={isPending}
          onClick={() =>
            startTransition(async () => {
              await markWhatsAppConnected(true);
              success();
              router.refresh();
            })
          }
        >
          Já conectei
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
