"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";

const PANEL_URL = "https://www.mercadopago.com.br/developers/panel/app";

export function MercadoPagoSetupGuide({
  webhookUrl,
  audience,
}: {
  webhookUrl: string;
  audience: "hotel" | "platform";
}) {
  const { success } = useFeedback();
  const who =
    audience === "hotel"
      ? "a conta Mercado Pago do hotel, que é onde cai o pagamento da reserva"
      : "a conta Mercado Pago da plataforma (é ela que recebe o PIX dos planos)";

  async function copyWebhook() {
    await navigator.clipboard.writeText(webhookUrl);
    success("URL do webhook copiada.");
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/40 p-4">
      <div>
        <p className="text-sm font-medium">Como ligar o PIX</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use {who}. O código de teste (TEST-) não recebe dinheiro de verdade.
        </p>
      </div>
      <ol className="space-y-3">
        <Step n={1}>
          Entre no Mercado Pago com a conta que vai receber o dinheiro.
        </Step>
        <Step n={2}>
          Abra{" "}
          <a
            href={PANEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Suas integrações
            <ExternalLink className="h-3 w-3" />
          </a>{" "}
          e clique em <strong>Criar aplicação</strong>.
        </Step>
        <Step n={3}>
          Dê um nome (ex.: PetFlow), escolha produto de{" "}
          <strong>pagamentos online</strong> (Checkout Transparente / API) e
          salve.
        </Step>
        <Step n={4}>
          Em <strong>Credenciais de produção</strong>, copie o{" "}
          <strong>Access Token</strong>. Ele começa com{" "}
          <span className="font-mono">APP_USR-</span>.
        </Step>
        <Step n={5}>
          Cole o token no campo abaixo e salve aqui no PetFlow.
        </Step>
        <Step n={6}>
          Na mesma aplicação, vá em{" "}
          <strong>Webhooks → Configurar notificações</strong>.
        </Step>
        <Step n={7}>
          Em <strong>Modo produção</strong>, cole a URL, marque o evento{" "}
          <strong>Pagamentos</strong> (payment) e salve.
        </Step>
      </ol>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          URL do webhook (produção)
        </p>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
          <code className="min-w-0 flex-1 break-all rounded-md border bg-background px-3 py-2 font-mono text-xs">
            {webhookUrl}
          </code>
          <Button type="button" variant="outline" className="w-full shrink-0 sm:w-auto" onClick={copyWebhook}>
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="pt-0.5 leading-relaxed text-muted-foreground">
        {children}
      </span>
    </li>
  );
}
