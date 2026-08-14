"use client";

import { useRef, useState, useTransition } from "react";
import { CreditCard, Save, Upload } from "lucide-react";
import {
  removeHotelLogo,
  removeMercadoPagoToken,
  saveDepositRate,
  saveHotelWhatsApp,
  saveMercadoPagoToken,
  uploadHotelLogoAction,
} from "@/actions/settings";
import { HotelServicesForm, type HotelServiceItem } from "@/components/dashboard/hotel-services-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
import { useFeedback } from "@/components/app-feedback";
import { MercadoPagoSetupGuide } from "@/components/mercadopago-setup-guide";

export type SettingsFormValues = {
  name: string;
  slug: string;
  whatsappNumber: string;
  depositRate: number;
  pixConfigured: boolean;
  webhookUrl: string;
  logoUrl: string | null;
  services: HotelServiceItem[];
};

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber);
  const [depositRate, setDepositRate] = useState(
    String(Math.round(initial.depositRate * 100)),
  );
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [pixConfigured, setPixConfigured] = useState(initial.pixConfigured);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);
  const [savingHotel, startHotel] = useTransition();
  const [savingDeposit, startDeposit] = useTransition();
  const [savingMp, startMp] = useTransition();
  const { success, error: toastError } = useFeedback();

  function onLogoChange(file?: File) {
    if (!file) return;
    const formData = new FormData();
    formData.set("logo", file);
    startHotel(async () => {
      setHotelError(null);
      const result = await uploadHotelLogoAction(formData);
      if (!result.ok) {
        setHotelError(result.error);
        toastError(result.error);
        return;
      }
      setLogoUrl(`${result.logoUrl}?t=${Date.now()}`);
      success("Logo salvo com sucesso.");
    });
  }

  function removeLogo() {
    startHotel(async () => {
      setHotelError(null);
      await removeHotelLogo();
      setLogoUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      success("Logo removido com sucesso.");
    });
  }

  function saveWhatsApp() {
    startHotel(async () => {
      setHotelError(null);
      await saveHotelWhatsApp(whatsappNumber);
      success("WhatsApp salvo.");
    });
  }

  function saveDeposit() {
    startDeposit(async () => {
      setDepositError(null);
      const result = await saveDepositRate(Number(depositRate) / 100);
      if (!result.ok) {
        setDepositError(result.error);
        toastError(result.error);
        return;
      }
      success("Sinal salvo.");
    });
  }

  function saveMp() {
    startMp(async () => {
      setMpError(null);
      const result = await saveMercadoPagoToken(mpAccessToken);
      if (!result.ok) {
        setMpError(result.error);
        toastError(result.error);
        return;
      }
      setPixConfigured(true);
      setMpAccessToken("");
      success("Mercado Pago salvo.");
    });
  }

  function removeToken() {
    startMp(async () => {
      await removeMercadoPagoToken();
      setPixConfigured(false);
      setMpAccessToken("");
      success("Token removido com sucesso.");
    });
  }

  const examplePrice =
    initial.services.find((service) => service.active)?.price || 0;

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
            <Label>Logo na agenda</Label>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex h-24 w-full max-w-40 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`Logo ${initial.name}`}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <span className="px-2 text-center text-xs text-muted-foreground">
                    Sem logo
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => onLogoChange(event.target.files?.[0])}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    loading={savingHotel}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {savingHotel ? "Enviando..." : logoUrl ? "Trocar logo" : "Enviar logo"}
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full sm:w-auto"
                      loading={savingHotel}
                      onClick={removeLogo}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG ou WEBP, até 4 MB. Aparece no topo da agenda pública.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp do hotel</Label>
            <Input
              id="whatsapp"
              value={whatsappNumber}
              onChange={(event) => setWhatsappNumber(event.target.value)}
              placeholder="11999999999"
            />
          </div>
          {hotelError && <p className="text-sm text-destructive">{hotelError}</p>}
          <Button type="button" className="w-full sm:w-auto" loading={savingHotel} onClick={saveWhatsApp}>
            <Save className="h-4 w-4" />
            Salvar estabelecimento
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Serviços e sinal</CardTitle>
          <CardDescription>
            Cadastre hotel, diária, banho e tosa, petsitter e o que mais o
            estabelecimento oferecer. Ative para aparecer na reserva; desative
            para esconder. O sinal é o percentual cobrado no PIX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <HotelServicesForm initial={initial.services} />
          <div className="max-w-full space-y-2 sm:max-w-xs">
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
              Ex.: {depositRate || 0}% de {formatBRL(examplePrice)} ={" "}
              {formatBRL((examplePrice * (Number(depositRate) || 0)) / 100)}
            </p>
          </div>
          {depositError && (
            <p className="text-sm text-destructive">{depositError}</p>
          )}
          <Button type="button" className="w-full sm:w-auto" loading={savingDeposit} onClick={saveDeposit}>
            <Save className="h-4 w-4" />
            Salvar sinal
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex min-w-0 items-center gap-2">
              <CreditCard className="h-5 w-5 shrink-0 text-primary" />
              Mercado Pago
            </CardTitle>
            <Badge className="shrink-0" variant={pixConfigured ? "success" : "warning"}>
              {pixConfigured ? "PIX ativo" : "PIX não configurado"}
            </Badge>
          </div>
          <CardDescription>
            Token da conta do hotel para o PIX do sinal nas reservas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MercadoPagoSetupGuide
            webhookUrl={initial.webhookUrl}
            audience="hotel"
          />
          <div className="space-y-2">
            <Label htmlFor="mp">Access Token</Label>
            <PasswordInput
              id="mp"
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
          {mpError && <p className="text-sm text-destructive">{mpError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className="w-full sm:w-auto"
              loading={savingMp}
              disabled={!mpAccessToken.trim()}
              onClick={saveMp}
            >
              <Save className="h-4 w-4" />
              Salvar Mercado Pago
            </Button>
            {pixConfigured && (
              <Button
                type="button"
                className="w-full sm:w-auto"
                variant="outline"
                loading={savingMp}
                onClick={removeToken}
              >
                Remover token
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
