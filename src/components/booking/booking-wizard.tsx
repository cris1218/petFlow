"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, PawPrint } from "lucide-react";
import {
  createBooking,
  getBookingPaymentStatus,
} from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SIZE_LABELS,
  SPECIES_LABELS,
} from "@/lib/constants";
import { BookableService, calculateStayPricing } from "@/lib/pricing";
import { formatBRL, formatDate } from "@/lib/utils";
import { useFeedback } from "@/components/app-feedback";

const STEPS = [
  "Serviço e período",
  "Tutor e pet",
  "Pagamento",
  "Confirmação",
];

type WizardProps = {
  tenantName: string;
  tenantSlug: string;
  tenantLogoUrl?: string | null;
  services: BookableService[];
  depositRate: number;
  requiredVaccines: Array<{ id: string; name: string }>;
  pixEnabled: boolean;
};

export function BookingWizard({
  tenantName,
  tenantSlug,
  tenantLogoUrl,
  services,
  depositRate,
  requiredVaccines,
  pixEnabled,
}: WizardProps) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tutor, setTutor] = useState({
    name: "",
    phone: "",
    cpf: "",
    address: "",
    email: "",
  });
  const [pet, setPet] = useState({
    name: "",
    species: "DOG" as "DOG" | "CAT" | "OTHER",
    breed: "",
    size: "MEDIUM" as "SMALL" | "MEDIUM" | "LARGE",
    notes: "",
  });
  const [hasVaccines, setHasVaccines] = useState<string[]>([]);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [pix, setPix] = useState<{
    qrCode: string;
    qrCodeBase64: string;
  } | null>(null);
  const [missingVaccines, setMissingVaccines] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success } = useFeedback();

  const selectedService = services.find((service) => service.id === serviceId) ?? services[0];

  const pricing = useMemo(() => {
    if (!startDate || !endDate || !selectedService) return null;
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return null;
    }
    return calculateStayPricing(selectedService.price, start, end, depositRate);
  }, [selectedService, startDate, endDate, depositRate]);

  useEffect(() => {
    if (step !== 3 || !bookingId || confirmed) return;

    const timer = setInterval(async () => {
      const result = await getBookingPaymentStatus(bookingId);
      if (result.ok && result.confirmed) {
        setConfirmed(true);
        setStep(4);
        success("Reserva confirmada com sucesso.");
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [step, bookingId, confirmed]);

  function goStep2() {
    if (!selectedService) {
      setError("Este hotel ainda não tem serviços ativos.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Escolha as datas da estadia.");
      return;
    }
    if (!pricing) {
      setError("Período inválido.");
      return;
    }
    setError(null);
    setStep(2);
  }

  function submitBooking() {
    if (!selectedService) {
      setError("Este hotel ainda não tem serviços ativos.");
      return;
    }
    const service = selectedService;
    if (!tutor.name || !tutor.phone || !pet.name) {
      setError("Preencha os dados do tutor e do pet.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await createBooking({
        tenantSlug,
        serviceId: service.id,
        startDate: `${startDate}T12:00:00`,
        endDate: `${endDate}T12:00:00`,
        tutor,
        pet,
        vaccines: hasVaccines.map((name) => ({ name })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBookingId(result.bookingId);
      setPix(result.pix);
      setMissingVaccines(result.missingVaccines);
      setStep(3);
      success("Reserva enviada com sucesso.");
    });
  }

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogoUrl}
              alt=""
              className="h-8 w-8 rounded-md object-contain"
            />
          ) : (
            <PawPrint className="h-5 w-5 text-primary" />
          )}
          Agendar em {tenantName}
        </CardTitle>
        <CardDescription>
          Passo {step} de 4 · {STEPS[step - 1]}
        </CardDescription>
        <div className="grid grid-cols-4 gap-2 pt-2">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={`h-1.5 rounded-full ${index < step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este estabelecimento ainda não cadastrou serviços ativos.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setServiceId(service.id)}
                    className={`rounded-xl border p-4 text-left ${
                      serviceId === service.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                  >
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatBRL(service.price)} / diária
                    </p>
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Entrada</Label>
                <Input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Saída</Label>
                <Input
                  id="end"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
            {pricing && (
              <p className="text-sm text-muted-foreground">
                {pricing.nights} diária(s) · Total {formatBRL(pricing.totalAmount)} ·
                Sinal {formatBRL(pricing.depositAmount)}
              </p>
            )}
            <Button className="w-full sm:w-auto" onClick={goStep2} disabled={services.length === 0}>
              Continuar
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome do tutor"
                value={tutor.name}
                onChange={(value) => setTutor({ ...tutor, name: value })}
              />
              <Field
                label="WhatsApp"
                value={tutor.phone}
                onChange={(value) => setTutor({ ...tutor, phone: value })}
                placeholder="11999999999"
              />
              <Field
                label="CPF"
                value={tutor.cpf}
                onChange={(value) => setTutor({ ...tutor, cpf: value })}
              />
              <Field
                label="E-mail (PIX)"
                value={tutor.email}
                onChange={(value) => setTutor({ ...tutor, email: value })}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Endereço"
                  value={tutor.address}
                  onChange={(value) => setTutor({ ...tutor, address: value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome do pet"
                value={pet.name}
                onChange={(value) => setPet({ ...pet, name: value })}
              />
              <Field
                label="Raça"
                value={pet.breed}
                onChange={(value) => setPet({ ...pet, breed: value })}
              />
              <div className="space-y-2">
                <Label>Espécie</Label>
                <Select
                  value={pet.species}
                  onValueChange={(value) =>
                    setPet({ ...pet, species: value as typeof pet.species })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Espécie" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SPECIES_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Porte</Label>
                <Select
                  value={pet.size}
                  onValueChange={(value) =>
                    setPet({ ...pet, size: value as typeof pet.size })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Porte" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SIZE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Vacinas que o pet tem</Label>
              {requiredVaccines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este hotel ainda não cadastrou vacinas obrigatórias.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {requiredVaccines.map((vaccine) => (
                    <label
                      key={vaccine.id}
                      className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={hasVaccines.includes(vaccine.name)}
                        onChange={(event) =>
                          setHasVaccines((current) =>
                            event.target.checked
                              ? [...current, vaccine.name]
                              : current.filter((name) => name !== vaccine.name),
                          )
                        }
                      />
                      {vaccine.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button className="w-full sm:w-auto" onClick={submitBooking} loading={isPending}>
                {isPending
                  ? "Enviando..."
                  : pixEnabled
                    ? "Gerar PIX do sinal"
                    : "Enviar reserva"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && pricing && (
          <div className="space-y-4">
            {pix ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Pague o sinal de {formatBRL(pricing.depositAmount)} via PIX. A
                  reserva confirma automaticamente após o pagamento.
                </p>
                {pix.qrCodeBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      pix.qrCodeBase64.startsWith("data:")
                        ? pix.qrCodeBase64
                        : `data:image/png;base64,${pix.qrCodeBase64}`
                    }
                    alt="QR Code PIX"
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Reserva enviada. Pague o sinal de{" "}
                {formatBRL(pricing.depositAmount)} no hotel. Assim que o
                estabelecimento confirmar, esta página atualiza sozinha.
              </p>
            )}
            {missingVaccines.length > 0 && (
              <Badge variant="warning">
                Vacinas não informadas: {missingVaccines.join(", ")}
              </Badge>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Check className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold">Reserva confirmada</h3>
            <p className="text-sm text-muted-foreground">
              {pet.name} está agendado de {formatDate(startDate)} a {formatDate(endDate)}.
              A confirmação foi enviada no WhatsApp de {tutor.name}.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
