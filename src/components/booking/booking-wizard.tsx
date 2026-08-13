"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, PawPrint } from "lucide-react";
import {
  createBooking,
  getBookingPaymentStatus,
  simulatePixPayment,
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
  SERVICE_DAILY_RATE,
  SERVICE_LABELS,
  SIZE_LABELS,
  SPECIES_LABELS,
} from "@/lib/constants";
import { calculateStayPricing } from "@/lib/pricing";
import { formatBRL, formatDate, vaccineStatusFromExpiration } from "@/lib/utils";
import { ServiceType } from "@prisma/client";

const STEPS = [
  "Serviço e período",
  "Tutor e pet",
  "Pagamento PIX",
  "Confirmação",
];

type WizardProps = {
  tenantName: string;
  tenantSlug: string;
};

export function BookingWizard({ tenantName, tenantSlug }: WizardProps) {
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState<ServiceType>("HOTEL");
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
  const [vaccines, setVaccines] = useState([
    { name: "V10", applicationDate: "", expirationDate: "" },
    { name: "Raiva", applicationDate: "", expirationDate: "" },
  ]);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [pix, setPix] = useState<{
    qrCode: string;
    qrCodeBase64: string;
    mocked: boolean;
  } | null>(null);
  const [expiredVaccines, setExpiredVaccines] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pricing = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return null;
    }
    return calculateStayPricing(serviceType, start, end);
  }, [serviceType, startDate, endDate]);

  const vaccineAlerts = useMemo(
    () =>
      vaccines
        .filter((vaccine) => vaccine.name && vaccine.expirationDate)
        .filter(
          (vaccine) =>
            vaccineStatusFromExpiration(new Date(`${vaccine.expirationDate}T12:00:00`)) ===
            "EXPIRED",
        )
        .map((vaccine) => vaccine.name),
    [vaccines],
  );

  useEffect(() => {
    if (step !== 3 || !bookingId || confirmed) return;

    const timer = setInterval(async () => {
      const result = await getBookingPaymentStatus(bookingId);
      if (result.ok && result.confirmed) {
        setConfirmed(true);
        setStep(4);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [step, bookingId, confirmed]);

  function goStep2() {
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
    if (!tutor.name || !tutor.phone || !pet.name) {
      setError("Preencha os dados do tutor e do pet.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await createBooking({
        tenantSlug,
        serviceType,
        startDate: `${startDate}T12:00:00`,
        endDate: `${endDate}T12:00:00`,
        tutor,
        pet,
        vaccines: vaccines
          .filter((vaccine) => vaccine.name && vaccine.applicationDate && vaccine.expirationDate)
          .map((vaccine) => ({
            name: vaccine.name,
            applicationDate: `${vaccine.applicationDate}T12:00:00`,
            expirationDate: `${vaccine.expirationDate}T12:00:00`,
          })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBookingId(result.bookingId);
      setPix(result.pix);
      setExpiredVaccines(result.expiredVaccines);
      setStep(3);
    });
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PawPrint className="h-5 w-5 text-primary" />
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
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setServiceType(type)}
                  className={`rounded-xl border p-4 text-left ${
                    serviceType === type
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <p className="font-semibold">{SERVICE_LABELS[type]}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBRL(SERVICE_DAILY_RATE[type])} / diária
                  </p>
                </button>
              ))}
            </div>
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
            <Button onClick={goStep2}>Continuar</Button>
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
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={pet.species}
                  onChange={(event) =>
                    setPet({ ...pet, species: event.target.value as typeof pet.species })
                  }
                >
                  {Object.entries(SPECIES_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Porte</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={pet.size}
                  onChange={(event) =>
                    setPet({ ...pet, size: event.target.value as typeof pet.size })
                  }
                >
                  {Object.entries(SIZE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Vacinas</Label>
              {vaccines.map((vaccine, index) => (
                <div key={vaccine.name} className="grid gap-2 sm:grid-cols-3">
                  <Input
                    value={vaccine.name}
                    onChange={(event) => {
                      const next = [...vaccines];
                      next[index] = { ...vaccine, name: event.target.value };
                      setVaccines(next);
                    }}
                  />
                  <Input
                    type="date"
                    value={vaccine.applicationDate}
                    onChange={(event) => {
                      const next = [...vaccines];
                      next[index] = {
                        ...vaccine,
                        applicationDate: event.target.value,
                      };
                      setVaccines(next);
                    }}
                  />
                  <Input
                    type="date"
                    value={vaccine.expirationDate}
                    onChange={(event) => {
                      const next = [...vaccines];
                      next[index] = {
                        ...vaccine,
                        expirationDate: event.target.value,
                      };
                      setVaccines(next);
                    }}
                  />
                </div>
              ))}
              {vaccineAlerts.length > 0 && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Vacinas vencidas: {vaccineAlerts.join(", ")}. O hotel será alertado no check-in.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={submitBooking} disabled={isPending}>
                {isPending ? "Gerando PIX..." : "Gerar PIX do sinal"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && pix && pricing && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pague o sinal de {formatBRL(pricing.depositAmount)} via PIX. A reserva
              confirma automaticamente após o pagamento.
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
                className="mx-auto h-56 w-56 rounded-xl border bg-white p-3"
              />
            ) : (
              <div className="rounded-xl border bg-muted p-4 text-center text-sm">
                {pix.mocked
                  ? "Modo demonstração: configure MP_ACCESS_TOKEN para PIX real. No sandbox, o webhook confirma a reserva."
                  : "QR Code indisponível. Use o código copia e cola."}
              </div>
            )}
            <div className="rounded-md border bg-muted p-3 font-mono text-xs break-all">
              {pix.qrCode}
            </div>
            {expiredVaccines.length > 0 && (
              <Badge variant="warning">Vacinas vencidas: {expiredVaccines.join(", ")}</Badge>
            )}
            <p className="text-sm text-muted-foreground">
              Aguardando confirmação do Mercado Pago...
            </p>
            {pix.mocked && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!bookingId) return;
                  startTransition(async () => {
                    const result = await simulatePixPayment(bookingId);
                    if (result.ok) {
                      setConfirmed(true);
                      setStep(4);
                    }
                  });
                }}
                disabled={isPending}
              >
                Simular pagamento (demo)
              </Button>
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
