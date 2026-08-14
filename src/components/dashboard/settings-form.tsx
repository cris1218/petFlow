"use client";

import { useRef, useState, useTransition } from "react";
import { Save, Upload } from "lucide-react";
import {
  removeHotelLogo,
  removeMercadoPagoToken,
  saveHotelWhatsApp,
  saveMercadoPagoToken,
  uploadHotelLogoAction,
} from "@/actions/settings";
import { HotelServicesForm, type HotelServiceItem } from "@/components/dashboard/hotel-services-form";
import { HotelScheduleForm, type HotelScheduleValues } from "@/components/dashboard/schedule-form";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { WhatsAppQrCard } from "@/components/dashboard/whatsapp-qr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { WhatsAppInput } from "@/components/ui/whatsapp-input";
import { useFeedback } from "@/components/app-feedback";
import { MercadoPagoSetupGuide } from "@/components/mercadopago-setup-guide";
import { BrandMark } from "@/components/brand-mark";
import { AccountForm } from "@/components/account-form";
import { CreateStaffForm } from "@/components/dashboard/staff-form";
import { StaffList } from "@/components/dashboard/staff-list";

export type SettingsFormValues = {
  name: string;
  slug: string;
  whatsappNumber: string;
  pixConfigured: boolean;
  webhookUrl: string;
  logoUrl: string | null;
  services: HotelServiceItem[];
  schedule: HotelScheduleValues;
};

export function SettingsForm({
  initial,
  whatsapp,
  staff,
  accountEmail,
}: {
  initial: SettingsFormValues;
  whatsapp: {
    connected: boolean;
    number: string | null;
    instanceName: string;
  };
  staff: Array<{ id: string; name: string; email: string }>;
  accountEmail: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber);
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [pixConfigured, setPixConfigured] = useState(initial.pixConfigured);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);
  const [savingHotel, startHotel] = useTransition();
  const [savingMp, startMp] = useTransition();
  const { success, error: toastError } = useFeedback();

  function onLogoChange(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      const message = "A foto deve ter no máximo 2 MB.";
      setHotelError(message);
      toastError(message);
      return;
    }
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
      const result = await saveHotelWhatsApp(whatsappNumber);
      if (!result.ok) {
        setHotelError(result.error);
        toastError(result.error);
        return;
      }
      success("WhatsApp salvo.");
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

  return (
    <div className="space-y-3">
      <SettingsSection
        title="Seu hotel"
        description="Aqui fica a cara do hotel: a foto que o cliente vê na hora de agendar e o WhatsApp para receber recado."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Foto do hotel</Label>
            <p className="text-xs text-muted-foreground">
              Use uma imagem quadrada, de preferência PNG sem fundo. Máximo 2 MB.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
              <div className="flex h-28 w-full max-w-[16rem] items-center justify-center overflow-hidden rounded-xl border bg-muted p-3">
                <BrandMark logoUrl={logoUrl} name={initial.name} size="lg" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/webp,image/jpeg"
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
                    {savingHotel ? "Enviando..." : logoUrl ? "Trocar foto" : "Enviar foto"}
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
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">Número do WhatsApp</Label>
            <p className="text-xs text-muted-foreground">
              É o telefone do hotel. Serve para o cliente saber com quem está falando.
            </p>
            <WhatsAppInput
              id="whatsapp"
              value={whatsappNumber}
              onChange={setWhatsappNumber}
            />
          </div>
          {hotelError && <p className="text-sm text-destructive">{hotelError}</p>}
          <Button type="button" className="w-full sm:w-auto" loading={savingHotel} onClick={saveWhatsApp}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="WhatsApp"
        description="Ligue o WhatsApp do hotel no sistema. Assim o tutor recebe a confirmação da reserva e as fotos do diário no celular."
        extra={
          <Badge variant={whatsapp.connected ? "success" : "warning"}>
            {whatsapp.connected ? "Ligado" : "Desligado"}
          </Badge>
        }
      >
        <WhatsAppQrCard
          connected={whatsapp.connected}
          number={whatsapp.number}
          instanceName={whatsapp.instanceName}
        />
      </SettingsSection>

      <SettingsSection
        title="Quem vocês aceitam"
        description="Marque o tamanho dos gatos e dos cães que o hotel recebe. Na hora de agendar, o cliente só vê o que estiver marcado."
      >
        <HotelScheduleForm initial={initial.schedule} />
      </SettingsSection>

      <SettingsSection
        title="Serviços e preços"
        description="Hotel, creche, petsitter e banho e tosa já vêm prontos. Ative o que vocês fazem e diga o preço."
      >
        <HotelServicesForm initial={initial.services} />
      </SettingsSection>

      <SettingsSection
        title="PIX para receber"
        description="É assim que o tutor paga a reserva. O dinheiro cai na conta Mercado Pago do hotel. Cole o código da sua conta e salve."
        extra={
          <Badge variant={pixConfigured ? "success" : "warning"}>
            {pixConfigured ? "PIX pronto" : "Falta configurar"}
          </Badge>
        }
      >
        <div className="space-y-4">
          <MercadoPagoSetupGuide
            webhookUrl={initial.webhookUrl}
            audience="hotel"
          />
          <div className="space-y-2">
            <Label htmlFor="mp">Código da conta (Access Token)</Label>
            <p className="text-xs text-muted-foreground">
              É a chave que o Mercado Pago gera para o hotel receber o PIX. Começa com APP_USR-.
            </p>
            <PasswordInput
              id="mp"
              autoComplete="off"
              value={mpAccessToken}
              onChange={(event) => setMpAccessToken(event.target.value)}
              placeholder={
                pixConfigured
                  ? "Deixe em branco para manter o código atual"
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
              Salvar PIX
            </Button>
            {pixConfigured && (
              <Button
                type="button"
                className="w-full sm:w-auto"
                variant="outline"
                loading={savingMp}
                onClick={removeToken}
              >
                Remover código
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Equipe"
        description="Quem trabalha no hotel. Elas veem reservas, entrada e o diário. Cada pessoa extra entra no plano (R$ 9,90). O primeiro gestor já está incluso."
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Nova pessoa</p>
            <CreateStaffForm />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">Quem já está na equipe</p>
            <StaffList users={staff} />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Minha conta"
        description="Seu login. Troque o e-mail ou a senha quando quiser."
      >
        <AccountForm email={accountEmail} />
      </SettingsSection>
    </div>
  );
}
