"use client";

import { useState, useTransition } from "react";
import { CreditCard, Save } from "lucide-react";
import {
  removeMercadoPagoToken,
  saveTenantSettings,
} from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";

export type SettingsFormValues = {
  name: string;
  slug: string;
  whatsappNumber: string;
  hotelRate: number;
  daycareRate: number;
  groomingRate: number;
  depositRate: number;
  pixConfigured: boolean;
  webhookUrl: string;
};

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber);
  const [hotelRate, setHotelRate] = useState(String(initial.hotelRate));
  const [daycareRate, setDaycareRate] = useState(String(initial.daycareRate));
  const [groomingRate, setGroomingRate] = useState(String(initial.groomingRate));
  const [depositRate, setDepositRate] = useState(
    String(Math.round(initial.depositRate * 100)),
  );
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [pixConfigured, setPixConfigured] = useState(initial.pixConfigured);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await saveTenantSettings({
        whatsappNumber,
        hotelRate: Number(hotelRate),
        daycareRate: Number(daycareRate),
        groomingRate: Number(groomingRate),
        depositRate: Number(depositRate) / 100,
        mpAccessToken,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mpAccessToken.trim()) {
        setPixConfigured(true);
        setMpAccessToken("");
      }
      setMessage("Configurações salvas.");
    });
  }

  function removeToken() {
    startTransition(async () => {
      await removeMercadoPagoToken();
      setPixConfigured(false);
      setMpAccessToken("");
      setMessage("Token do Mercado Pago removido. Reservas passam a ser confirmadas no painel.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Estabelecimento</CardTitle>
          <CardDescription>
            {initial.name} · portal público /agendar/{initial.slug}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp do hotel</Label>
            <Input
              id="whatsapp"
              value={whatsappNumber}
              onChange={(event) => setWhatsappNumber(event.target.value)}
              placeholder="11999999999"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diárias e sinal</CardTitle>
          <CardDescription>
            Valores usados no portal de agendamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <MoneyField
            label="Hotel / diária"
            value={hotelRate}
            onChange={setHotelRate}
          />
          <MoneyField
            label="Creche / diária"
            value={daycareRate}
            onChange={setDaycareRate}
          />
          <MoneyField
            label="Banho e tosa / diária"
            value={groomingRate}
            onChange={setGroomingRate}
          />
          <div className="space-y-2">
            <Label htmlFor="deposit">Sinal (%)</Label>
            <Input
              id="deposit"
              type="number"
              min="1"
              max="100"
              value={depositRate}
              onChange={(event) => setDepositRate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ex.: 30% de {formatBRL(Number(hotelRate) || 0)} ={" "}
              {formatBRL(((Number(hotelRate) || 0) * (Number(depositRate) || 0)) / 100)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Mercado Pago
            </CardTitle>
            <Badge variant={pixConfigured ? "success" : "warning"}>
              {pixConfigured ? "PIX ativo" : "PIX não configurado"}
            </Badge>
          </div>
          <CardDescription>
            Cole o Access Token da conta do hotel. O PetFlow não mostra o token
            depois de salvo. No Mercado Pago, cadastre o webhook{" "}
            <span className="font-mono text-xs">{initial.webhookUrl}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mp">Access Token</Label>
            <Input
              id="mp"
              type="password"
              autoComplete="off"
              value={mpAccessToken}
              onChange={(event) => setMpAccessToken(event.target.value)}
              placeholder={
                pixConfigured
                  ? "Deixe em branco para manter o token atual"
                  : "APP_USR-..."
              }
            />
          </div>
          {pixConfigured && (
            <Button
              type="button"
              variant="outline"
              onClick={removeToken}
              disabled={isPending}
            >
              Remover token
            </Button>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-accent-foreground">{message}</p>}

      <Button onClick={save} disabled={isPending}>
        <Save className="h-4 w-4" />
        {isPending ? "Salvando..." : "Salvar configurações"}
      </Button>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min="1"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
