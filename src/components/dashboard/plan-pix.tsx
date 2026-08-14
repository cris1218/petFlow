"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, QrCode } from "lucide-react";
import {
  createSubscriptionPix,
  getSubscriptionPaymentStatus,
  verifySubscriptionPix,
} from "@/actions/billing";
import { useFeedback } from "@/components/app-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";

type PlanPixProps = {
  hotelName: string;
  pixConfigured: boolean;
  isExpired: boolean;
  phaseLabel: string;
  priceLabel: string;
  expiresLabel: string;
  pixAmount: number;
  extraUsers: number;
  extraTotal: number;
  pending: {
    id: string;
    amount: number;
    qrCode: string | null;
    qrCodeBase64: string | null;
  } | null;
};

export function PlanPix({
  hotelName,
  pixConfigured,
  isExpired,
  phaseLabel,
  priceLabel,
  expiresLabel,
  pixAmount,
  extraUsers,
  extraTotal,
  pending,
}: PlanPixProps) {
  const router = useRouter();
  const [pix, setPix] = useState<{
    id: string;
    amount: number;
    qrCode: string;
    qrCodeBase64: string;
  } | null>(
    pending?.qrCode
      ? {
          id: pending.id,
          amount: pending.amount,
          qrCode: pending.qrCode,
          qrCodeBase64: pending.qrCodeBase64 ?? "",
        }
      : null,
  );
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useFeedback();

  useEffect(() => {
    if (!pix || paid) return;

    const timer = window.setInterval(async () => {
      const result = await getSubscriptionPaymentStatus(pix.id);
      if (result.ok && result.paid) {
        setPaid(true);
        success("Pagamento confirmado. +30 dias liberados.");
        router.refresh();
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [pix, paid, success, router]);

  function generatePix() {
    startTransition(async () => {
      setError(null);
      const result = await createSubscriptionPix();
      if (!result.ok) {
        setError(result.error);
        toastError(result.error);
        return;
      }
      setPix({
        id: result.paymentId,
        amount: result.amount,
        qrCode: result.qrCode,
        qrCodeBase64: result.qrCodeBase64,
      });
      success("PIX gerado. Pague para liberar mais 30 dias.");
    });
  }

  function verify() {
    startTransition(async () => {
      setError(null);
      const result = await verifySubscriptionPix();
      if (!result.ok) {
        setError(result.error);
        toastError(result.error);
        return;
      }
      if (result.paid) {
        setPaid(true);
        success("Pagamento confirmado. +30 dias liberados.");
        router.refresh();
        return;
      }
      success("Ainda não consta como pago no Mercado Pago.");
    });
  }

  async function copyCode() {
    if (!pix?.qrCode) return;
    await navigator.clipboard.writeText(pix.qrCode);
    success("Código PIX copiado.");
  }

  const amount = pix?.amount ?? pixAmount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle>{hotelName}</CardTitle>
            <Badge className="shrink-0" variant={isExpired ? "warning" : "success"}>
              {isExpired ? "Expirado" : phaseLabel}
            </Badge>
          </div>
          <CardDescription>
            {priceLabel} · {expiresLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Pague {formatBRL(amount)} via PIX na conta Mercado Pago da
            plataforma. Depois da confirmação, o acesso ganha mais 30 dias.
          </p>
          {extraUsers > 0 && (
            <p className="text-muted-foreground">
              Inclui {extraUsers} usuário(s) extra · {formatBRL(extraTotal)}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            PIX de 30 dias
          </CardTitle>
          <CardDescription>
            Qualquer usuário do hotel pode pagar. O webhook do Mercado Pago
            confirma sozinho; se não atualizar, use Verificar pagamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pixConfigured && (
            <p className="text-sm text-destructive">
              O master ainda não configurou a conta Mercado Pago da
              plataforma. Não é possível gerar o PIX agora.
            </p>
          )}

          {paid ? (
            <div className="flex items-start gap-3 rounded-xl border bg-accent/40 p-4">
              <Check className="mt-0.5 h-5 w-5 text-accent-foreground" />
              <div>
                <p className="font-medium">Pagamento confirmado</p>
                <p className="text-sm text-muted-foreground">
                  Mais 30 dias foram adicionados ao plano.
                </p>
              </div>
            </div>
          ) : pix ? (
            <>
              {pix.qrCodeBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    pix.qrCodeBase64.startsWith("data:")
                      ? pix.qrCodeBase64
                      : `data:image/png;base64,${pix.qrCodeBase64}`
                  }
                  alt="QR Code PIX do plano"
                  className="mx-auto h-44 w-44 rounded-xl border bg-white p-3 sm:h-56 sm:w-56"
                />
              ) : (
                <div className="rounded-xl border bg-muted p-4 text-center text-sm">
                  QR Code indisponível. Use o código copia e cola.
                </div>
              )}
              <div className="rounded-md border bg-muted p-3 font-mono text-xs break-all">
                {pix.qrCode}
              </div>
              <p className="text-sm text-muted-foreground">
                Aguardando confirmação do Mercado Pago...
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={copyCode}>
                  <Copy className="h-4 w-4" />
                  Copiar PIX
                </Button>
                <Button type="button" className="w-full sm:w-auto" loading={isPending} onClick={verify}>
                  Já paguei, verificar
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              className="w-full sm:w-auto"
              loading={isPending}
              disabled={!pixConfigured}
              onClick={generatePix}
            >
              Gerar PIX de {formatBRL(pixAmount)}
            </Button>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
