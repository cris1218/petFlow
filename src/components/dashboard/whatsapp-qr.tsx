"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
import {
  markWhatsAppConnected,
  pairWhatsApp,
  refreshWhatsAppQr,
} from "@/actions/whatsapp";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFeedback } from "@/components/app-feedback";

export function WhatsAppQrCard({
  connected,
  number,
  instanceName,
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
        "QR ainda não chegou. Clique em Gerar QR Code de novo. Se persistir, no Railway da Evolution confira SERVER_URL=https://evolution-api-production-98c1.up.railway.app",
      );
      setStatus(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2">
            <QrCode className="h-5 w-5 shrink-0 text-primary" />
            Conexão WhatsApp
          </CardTitle>
          <Badge className="shrink-0" variant={connected ? "success" : "warning"}>
            {connected ? "Conectado" : "Aguardando pareamento"}
          </Badge>
        </div>
        <CardDescription>
          Escaneie o QR Code da Evolution API com o WhatsApp do hotel.
          Instância: {instanceName}
          {number ? ` · ${number}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                  ? "Evolution API não configurada."
                  : "Gere o QR Code para parear o número do estabelecimento.")}
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
            Marcar como conectado
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
