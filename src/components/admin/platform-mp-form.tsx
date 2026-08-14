"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import {
  removePlatformMpToken,
  savePlatformMpToken,
} from "@/actions/platform";
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
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { MercadoPagoSetupGuide } from "@/components/mercadopago-setup-guide";
import { APP_NAME } from "@/lib/constants";

export function PlatformMpForm({
  pixConfigured,
  webhookUrl,
}: {
  pixConfigured: boolean;
  webhookUrl: string;
}) {
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState(pixConfigured);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useFeedback();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2">
            <CreditCard className="h-5 w-5 shrink-0 text-primary" />
            Mercado Pago da plataforma
          </CardTitle>
          <Badge className="shrink-0" variant={configured ? "success" : "warning"}>
            {configured ? "PIX ativo" : "PIX não configurado"}
          </Badge>
        </div>
        <CardDescription>
          Conta que recebe o PIX dos hotéis para renovar o plano. O {APP_NAME} não
          mostra o token depois de salvo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await savePlatformMpToken(token);
              if (!result.ok) {
                setError(result.error);
                toastError(result.error);
                return;
              }
              setConfigured(true);
              setToken("");
              success("Conta Mercado Pago salva.");
            });
          }}
        >
          <MercadoPagoSetupGuide webhookUrl={webhookUrl} audience="platform" />
          <div className="space-y-2">
            <Label htmlFor="platform-mp">Access Token</Label>
            <PasswordInput
              id="platform-mp"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={
                configured
                  ? "Deixe em branco para manter o token atual"
                  : "APP_USR-..."
              }
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="submit" className="w-full sm:w-auto" loading={isPending} disabled={!token.trim()}>
              Salvar token
            </Button>
            {configured && (
              <Button
                type="button"
                className="w-full sm:w-auto"
                variant="outline"
                loading={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await removePlatformMpToken();
                    setConfigured(false);
                    setToken("");
                    success("Token removido.");
                  })
                }
              >
                Remover token
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
