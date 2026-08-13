"use client";

import { useState, useTransition } from "react";
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

  async function requestQr(refresh: boolean) {
    const result = refresh ? await refreshWhatsAppQr() : await pairWhatsApp();
    if (!result.ok) {
      setError(result.error ?? "Não foi possível gerar o QR Code.");
      return false;
    }
    setMocked(result.mocked);
    if (result.qrBase64) {
      setQr(result.qrBase64);
      setStatus(null);
      return true;
    }
    setStatus("A Evolution está gerando o QR. Tentando de novo…");
    return false;
  }

  function loadQr(refresh = false) {
    startTransition(async () => {
      setError(null);
      const gotQr = await requestQr(refresh);
      if (gotQr) return;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const got = await requestQr(true);
        if (got) return;
      }

      setError("QR ainda não chegou. Confira SERVER_URL no Railway e clique em Atualizar.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Conexão WhatsApp
          </CardTitle>
          <Badge variant={connected ? "success" : "warning"}>
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
        <div className="flex aspect-square max-w-xs items-center justify-center rounded-xl border bg-muted p-4">
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
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => loadQr(false)} disabled={isPending}>
            {isPending ? "Gerando..." : "Gerar QR Code"}
          </Button>
          <Button
            variant="outline"
            onClick={() => loadQr(true)}
            disabled={isPending}
          >
            Atualizar
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              startTransition(async () => {
                await markWhatsAppConnected(true);
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
