"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  createBooking,
  getBookingPaymentStatus,
} from "@/actions/bookings";
import {
  getPublicAppointmentSlots,
  getPublicStayAvailability,
} from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppInput } from "@/components/ui/whatsapp-input";
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
  allowedSpecies,
  hasPetCareProfile,
  sizesForSpecies,
  type PetPolicy,
  type PetSize,
} from "@/lib/constants";
import { BookableService, calculateStayPricing } from "@/lib/pricing";
import { formatBRL, formatBookingWhen, formatDate, formatFullAddress, phoneDigits, cpfDigits, cepDigits } from "@/lib/utils";
import { lookupCep } from "@/lib/cep";
import { CpfInput } from "@/components/ui/cpf-input";
import { CepInput } from "@/components/ui/cep-input";
import { SERVICE_KIND_LABELS, eachDateKey, effectiveServiceKind, toDateKey } from "@/lib/schedule";
import { useFeedback } from "@/components/app-feedback";

const STEPS = [
  "Serviço e agenda",
  "Tutor e pet",
  "Pagamento",
  "Confirmação",
];

const FULL_CAPACITY_MESSAGE =
  "Está com a lotação máxima nesse período. Escolha outras datas.";

type WizardProps = {
  tenantName: string;
  tenantSlug: string;
  tenantLogoUrl?: string | null;
  services: BookableService[];
  requiredVaccines: Array<{ id: string; name: string }>;
  pixEnabled: boolean;
  petPolicy: PetPolicy;
};

function firstSpecies(policy: PetPolicy) {
  return allowedSpecies(policy)[0] ?? "DOG";
}

function firstSize(species: keyof typeof SPECIES_LABELS, policy: PetPolicy): PetSize {
  return sizesForSpecies(species, policy)[0] ?? "SMALL";
}

export function BookingWizard({
  tenantName,
  tenantSlug,
  tenantLogoUrl,
  services,
  requiredVaccines,
  pixEnabled,
  petPolicy,
}: WizardProps) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("12:00");
  const [stayInfo, setStayInfo] = useState<{
    remaining: number;
    capacity: number;
    available: boolean;
    closedDays?: string[];
    catRemaining?: number;
    dogRemaining?: number;
    catCapacity?: number;
    dogCapacity?: number;
    extraNight?: boolean;
  } | null>(null);
  const [slots, setSlots] = useState<Array<{ time: string; available: boolean }>>(
    [],
  );
  const [slotsClosed, setSlotsClosed] = useState(false);
  const [checkingAgenda, setCheckingAgenda] = useState(false);
  const [tutor, setTutor] = useState({
    name: "",
    phone: "",
    cpf: "",
  });
  const [address, setAddress] = useState({
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    uf: "",
  });
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pixKind, setPixKind] = useState<"CPF" | "EMAIL" | "PHONE">("CPF");
  const [pixKey, setPixKey] = useState("");
  const [pet, setPet] = useState({
    name: "",
    species: firstSpecies(petPolicy) as "DOG" | "CAT" | "OTHER",
    breed: "",
    size: firstSize(firstSpecies(petPolicy), petPolicy),
    notes: "",
    castrated: null as boolean | null,
    vaccinated: null as boolean | null,
    aggressive: null as boolean | null,
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
  const selectedKind = selectedService
    ? effectiveServiceKind(selectedService.kind, selectedService.name)
    : "STAY";
  const isAppointment = selectedKind === "APPOINTMENT";
  const isHotel = selectedKind === "STAY";
  const isDaycare = selectedKind === "DAYCARE";
  const todayKey = toDateKey(new Date());
  const cutoffTime = selectedService?.dailyCutoffTime || "12:00";
  const needsEntrada = Number(selectedService?.depositAmount ?? 0) > 0;
  const speciesAtCapacity = Boolean(
    stayInfo &&
      (isDaycare
        ? !stayInfo.available
        : pet.species === "CAT"
          ? (stayInfo.catRemaining ?? 0) <= 0
          : (stayInfo.dogRemaining ?? 0) <= 0),
  );
  const periodAtCapacity = Boolean(
    stayInfo &&
      (isDaycare
        ? !stayInfo.available
        : (allowedSpecies(petPolicy).includes("CAT")
            ? (stayInfo.catRemaining ?? 0) <= 0
            : true) &&
          (allowedSpecies(petPolicy).some((species) => species !== "CAT")
            ? (stayInfo.dogRemaining ?? 0) <= 0
            : true)),
  );

  const pricing = useMemo(() => {
    if (!startDate || !selectedService) return null;
    const end = isAppointment ? startDate : endDate;
    if (!end) return null;
    const start = new Date(`${startDate}T12:00:00`);
    const finish = new Date(`${end}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime()) || finish < start) {
      return null;
    }
    return calculateStayPricing(selectedService.price, start, finish, {
      checkoutTime: isHotel ? checkoutTime : undefined,
      cutoffTime,
      depositAmount: selectedService.depositAmount,
      days: isAppointment
        ? 1
        : isDaycare
          ? eachDateKey(start, finish).length
          : undefined,
    });
  }, [
    selectedService,
    startDate,
    endDate,
    isAppointment,
    isHotel,
    isDaycare,
    checkoutTime,
    cutoffTime,
  ]);

  useEffect(() => {
    const digits = cepDigits(address.cep);
    if (digits.length !== 8) {
      setCepStatus("idle");
      return;
    }

    const controller = new AbortController();
    setCepStatus("loading");
    lookupCep(digits, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result) {
          setCepStatus("error");
          return;
        }
        setAddress((current) => ({
          ...current,
          street: result.street || current.street,
          neighborhood: result.neighborhood || current.neighborhood,
          city: result.city,
          uf: result.uf,
        }));
        setCepStatus("idle");
      })
      .catch(() => {
        if (!controller.signal.aborted) setCepStatus("error");
      });

    return () => controller.abort();
  }, [address.cep]);

  useEffect(() => {
    setSlotTime("");
    setStayInfo(null);
    setSlots([]);
    setSlotsClosed(false);
    setCheckoutTime(selectedService?.dailyCutoffTime || "12:00");
    if (isAppointment && startDate && !endDate) {
      setEndDate(startDate);
    }
  }, [serviceId]);

  useEffect(() => {
    if (!isAppointment || !startDate) {
      setSlots([]);
      setSlotsClosed(false);
      return;
    }
    setEndDate(startDate);
    let cancelled = false;
    setCheckingAgenda(true);
    getPublicAppointmentSlots({
      tenantSlug,
      serviceId: selectedService?.id ?? serviceId,
      date: startDate,
    }).then((result) => {
      if (cancelled) return;
      setCheckingAgenda(false);
      if (!result.ok) {
        setSlots([]);
        setSlotsClosed(false);
        setError(result.error);
        return;
      }
      setSlotsClosed(result.closed || result.pastDay);
      setSlots(result.slots);
      setSlotTime((current) =>
        result.slots.some((slot) => slot.time === current && slot.available)
          ? current
          : "",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isAppointment, startDate, tenantSlug, selectedService?.id, serviceId]);

  useEffect(() => {
    if (isAppointment || !startDate || !endDate) {
      if (isAppointment) setStayInfo(null);
      return;
    }
    let cancelled = false;
    setCheckingAgenda(true);
    getPublicStayAvailability({
      tenantSlug,
      serviceId: selectedService?.id ?? serviceId,
      startDate,
      endDate,
      checkoutTime: isHotel ? checkoutTime : undefined,
      species: pet.species,
    }).then((result) => {
      if (cancelled) return;
      setCheckingAgenda(false);
      if (!result.ok) {
        setStayInfo(null);
        setError(result.error);
        return;
      }
      setStayInfo({
        remaining: result.remaining,
        capacity: result.capacity,
        available: result.available,
        closedDays: result.closedDays,
        catRemaining: result.catRemaining,
        dogRemaining: result.dogRemaining,
        catCapacity: result.catCapacity,
        dogCapacity: result.dogCapacity,
        extraNight: result.extraNight,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    isAppointment,
    isHotel,
    startDate,
    endDate,
    tenantSlug,
    selectedService?.id,
    serviceId,
    checkoutTime,
    pet.species,
  ]);

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
    if (isAppointment) {
      if (!startDate || !slotTime) {
        setError("Escolha o dia e um horário livre.");
        return;
      }
    } else {
      if (!startDate || !endDate) {
        setError(isDaycare ? "Escolha os dias de atendimento." : "Escolha as datas da hospedagem.");
        return;
      }
      if (stayInfo && periodAtCapacity) {
        setError(FULL_CAPACITY_MESSAGE);
        return;
      }
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
    if (!tutor.name || phoneDigits(tutor.phone).length < 10 || !pet.name) {
      setError("Preencha os dados do tutor e do pet.");
      return;
    }
    if (pixEnabled && needsEntrada) {
      if (pixKind === "CPF" && cpfDigits(pixKey || tutor.cpf).length !== 11) {
        setError("Informe um CPF válido para o PIX.");
        return;
      }
      if (pixKind === "EMAIL" && (!pixKey.includes("@") || pixKey.trim().length < 5)) {
        setError("Informe um e-mail válido para o PIX.");
        return;
      }
      if (pixKind === "PHONE" && phoneDigits(pixKey || tutor.phone).length < 10) {
        setError("Informe um celular válido para o PIX.");
        return;
      }
    }
    if (!isAppointment && stayInfo && speciesAtCapacity) {
      setError(FULL_CAPACITY_MESSAGE);
      return;
    }
    if (
      hasPetCareProfile(pet.species) &&
      (pet.castrated === null || pet.vaccinated === null || pet.aggressive === null)
    ) {
      setError("Informe se o pet é castrado, se tomou vacina e se é agressivo.");
      return;
    }
    if (!allowedSpecies(petPolicy).includes(pet.species)) {
      setError("Este hotel não atende essa espécie.");
      return;
    }
    if (!sizesForSpecies(pet.species, petPolicy).includes(pet.size)) {
      setError("Este hotel não atende esse porte.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await createBooking({
        tenantSlug,
        serviceId: service.id,
        startDate: `${startDate}T12:00:00`,
        endDate: `${isAppointment ? startDate : endDate}T12:00:00`,
        slotTime: isAppointment ? slotTime : undefined,
        checkoutTime: isHotel ? checkoutTime : undefined,
        tutor: {
          name: tutor.name,
          phone: tutor.phone,
          cpf: tutor.cpf,
          address: formatFullAddress(address),
          pix: pixEnabled && needsEntrada
            ? {
                kind: pixKind,
                key:
                  pixKind === "CPF"
                    ? pixKey || tutor.cpf
                    : pixKind === "PHONE"
                      ? pixKey || tutor.phone
                      : pixKey,
              }
            : undefined,
        },
        pet: {
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          size: pet.size,
          notes: pet.notes,
          castrated: hasPetCareProfile(pet.species) ? Boolean(pet.castrated) : undefined,
          vaccinated: hasPetCareProfile(pet.species) ? Boolean(pet.vaccinated) : undefined,
          aggressive: hasPetCareProfile(pet.species) ? Boolean(pet.aggressive) : undefined,
        },
        vaccines: hasVaccines.map((name) => ({ name })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBookingId(result.bookingId);
      setPix(result.pix);
      setMissingVaccines(result.missingVaccines);
      if (result.confirmed) {
        setConfirmed(true);
        setStep(4);
        success("Reserva confirmada com sucesso.");
        return;
      }
      setStep(3);
      success("Reserva enviada com sucesso.");
    });
  }

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <BrandMark logoUrl={tenantLogoUrl} name={tenantName} size="sm" />
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
                      {formatBRL(service.price)}
                      {service.kind === "APPOINTMENT"
                        ? " / atendimento"
                        : service.kind === "DAYCARE"
                          ? " / dia"
                          : " / diária"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {SERVICE_KIND_LABELS[service.kind]}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {isAppointment ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Dia do atendimento</Label>
                  <Input
                    id="start"
                    type="date"
                    min={todayKey}
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                {checkingAgenda && startDate ? (
                  <p className="text-sm text-muted-foreground">Carregando horários...</p>
                ) : null}
                {startDate && slotsClosed ? (
                  <p className="text-sm text-destructive">
                    O hotel não atende neste dia. Escolha outra data.
                  </p>
                ) : null}
                {startDate && !slotsClosed && slots.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setSlotTime(slot.time)}
                          className={`min-h-11 rounded-xl border text-sm ${
                            slotTime === slot.time
                              ? "border-primary bg-primary/10 font-medium text-primary"
                              : slot.available
                                ? "hover:bg-muted"
                                : "cursor-not-allowed text-muted-foreground opacity-50"
                          }`}
                        >
                          {slot.time}
                          {!slot.available ? (
                            <span className="block text-[10px]">Ocupado</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Horários ocupados não podem ser escolhidos.
                    </p>
                  </div>
                ) : null}
                {startDate && !checkingAgenda && !slotsClosed && slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum horário neste dia.
                  </p>
                ) : null}
              </div>
            ) : isDaycare ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Dias de atendimento</Label>
                  <p className="text-xs text-muted-foreground">
                    Só os dias em que o pet vai ser atendido. Não tem entrada, saída nem
                    horário de saída.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start">De</Label>
                    <Input
                      id="start"
                      type="date"
                      min={todayKey}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">Até</Label>
                    <Input
                      id="end"
                      type="date"
                      min={startDate || todayKey}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                </div>
                {checkingAgenda && startDate && endDate ? (
                  <p className="text-sm text-muted-foreground">Consultando vagas...</p>
                ) : null}
                {stayInfo?.closedDays?.length ? (
                  <p className="text-sm text-destructive">
                    Não atende em um dos dias escolhidos.
                  </p>
                ) : periodAtCapacity ? (
                  <p className="text-sm text-destructive">{FULL_CAPACITY_MESSAGE}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="start">Entrada</Label>
                    <Input
                      id="start"
                      type="date"
                      min={todayKey}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">Saída</Label>
                    <Input
                      id="end"
                      type="date"
                      min={startDate || todayKey}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkout-time">Horário de saída</Label>
                    <Input
                      id="checkout-time"
                      type="time"
                      value={checkoutTime}
                      onChange={(event) => setCheckoutTime(event.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A diária vence às {cutoffTime}. Depois disso, conta o dia seguinte.
                </p>
                {checkingAgenda && startDate && endDate ? (
                  <p className="text-sm text-muted-foreground">Consultando vagas...</p>
                ) : null}
                {periodAtCapacity ? (
                  <p className="text-sm text-destructive">{FULL_CAPACITY_MESSAGE}</p>
                ) : stayInfo?.extraNight ? (
                  <p className="text-sm text-muted-foreground">
                    Saída depois do vencimento da diária (+1 diária).
                  </p>
                ) : null}
              </div>
            )}
            {pricing && (
              <p className="text-sm text-muted-foreground">
                {isAppointment
                  ? `1 atendimento · Total ${formatBRL(pricing.totalAmount)}`
                  : isDaycare
                    ? `${pricing.nights} dia(s) · Total ${formatBRL(pricing.totalAmount)}`
                    : `${pricing.nights} diária(s) · Total ${formatBRL(pricing.totalAmount)}`}
                {pricing.depositAmount > 0
                  ? ` · Entrada ${formatBRL(pricing.depositAmount)}`
                  : ""}
              </p>
            )}
            <Button
              className="w-full sm:w-auto"
              onClick={goStep2}
              disabled={
                services.length === 0 ||
                (isAppointment ? !slotTime : Boolean(stayInfo && periodAtCapacity))
              }
            >
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
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <WhatsAppInput
                  value={tutor.phone}
                  onChange={(value) => {
                    setTutor({ ...tutor, phone: value });
                    if (pixKind === "PHONE") setPixKey(value);
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <CpfInput
                  value={tutor.cpf}
                  onChange={(value) => {
                    setTutor({ ...tutor, cpf: value });
                    if (pixKind === "CPF") setPixKey(value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <CepInput
                  value={address.cep}
                  onChange={(value) => setAddress({ ...address, cep: value })}
                />
                {cepStatus === "loading" ? (
                  <p className="text-xs text-muted-foreground">Buscando endereço…</p>
                ) : null}
                {cepStatus === "error" ? (
                  <p className="text-xs text-destructive">CEP não encontrado. Preencha o endereço.</p>
                ) : null}
              </div>
              <Field
                label="Número"
                value={address.number}
                onChange={(value) => setAddress({ ...address, number: value })}
                placeholder="123"
              />
              <div className="sm:col-span-2">
                <Field
                  label="Rua"
                  value={address.street}
                  onChange={(value) => setAddress({ ...address, street: value })}
                  placeholder="Rua, avenida…"
                />
              </div>
              <Field
                label="Complemento"
                value={address.complement}
                onChange={(value) => setAddress({ ...address, complement: value })}
                placeholder="Apto, bloco…"
              />
              <Field
                label="Bairro"
                value={address.neighborhood}
                onChange={(value) => setAddress({ ...address, neighborhood: value })}
              />
              <Field
                label="Cidade"
                value={address.city}
                onChange={(value) => setAddress({ ...address, city: value })}
              />
              <Field
                label="UF"
                value={address.uf}
                onChange={(value) =>
                  setAddress({ ...address, uf: value.toUpperCase().slice(0, 2) })
                }
                placeholder="SP"
              />
            </div>
            {pixEnabled && needsEntrada ? (
              <div className="space-y-3 rounded-xl border p-4">
                <div>
                  <Label>Chave PIX</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pode ser CPF, e-mail ou celular. Usamos para gerar o PIX da
                    entrada.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["CPF", "CPF"],
                      ["EMAIL", "E-mail"],
                      ["PHONE", "Celular"],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        setPixKind(kind);
                        if (kind === "CPF") setPixKey(tutor.cpf);
                        else if (kind === "PHONE") setPixKey(tutor.phone);
                        else setPixKey("");
                      }}
                      className={`min-h-11 rounded-xl border text-sm ${
                        pixKind === kind
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {pixKind === "CPF" ? (
                  <CpfInput
                    value={pixKey}
                    onChange={setPixKey}
                    aria-label="CPF do PIX"
                  />
                ) : null}
                {pixKind === "EMAIL" ? (
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="email@exemplo.com"
                    value={pixKey}
                    onChange={(event) => setPixKey(event.target.value)}
                  />
                ) : null}
                {pixKind === "PHONE" ? (
                  <WhatsAppInput
                    value={pixKey}
                    onChange={setPixKey}
                    aria-label="Celular do PIX"
                  />
                ) : null}
              </div>
            ) : null}
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
                  onValueChange={(value) => {
                    const species = value as typeof pet.species;
                    setPet({
                      ...pet,
                      species,
                      size: firstSize(species, petPolicy),
                      castrated: hasPetCareProfile(species) ? pet.castrated : null,
                      vaccinated: hasPetCareProfile(species) ? pet.vaccinated : null,
                      aggressive: hasPetCareProfile(species) ? pet.aggressive : null,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Espécie" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedSpecies(petPolicy).map((value) => (
                      <SelectItem key={value} value={value}>
                        {SPECIES_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {speciesAtCapacity ? (
                  <p className="text-sm text-destructive">{FULL_CAPACITY_MESSAGE}</p>
                ) : null}
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
                    {sizesForSpecies(pet.species, petPolicy).map((value) => (
                      <SelectItem key={value} value={value}>
                        {SIZE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasPetCareProfile(pet.species) ? (
              <div className="space-y-3 rounded-xl border p-3">
                <p className="text-sm font-medium">
                  {pet.species === "CAT" ? "Sobre o gato" : "Sobre o cão"}
                </p>
                <YesNo
                  label="É castrado?"
                  value={pet.castrated}
                  onChange={(value) => setPet({ ...pet, castrated: value })}
                />
                <YesNo
                  label="Tomou vacina?"
                  value={pet.vaccinated}
                  onChange={(value) => setPet({ ...pet, vaccinated: value })}
                />
                <YesNo
                  label="É agressivo?"
                  value={pet.aggressive}
                  onChange={(value) => setPet({ ...pet, aggressive: value })}
                />
              </div>
            ) : null}
            {requiredVaccines.length > 0 ? (
              <div className="space-y-3">
                <Label>Vacinas que o pet tem</Label>
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
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button className="w-full sm:w-auto" onClick={submitBooking} loading={isPending}>
                {isPending
                  ? "Enviando..."
                  : pixEnabled && needsEntrada
                    ? "Gerar PIX da entrada"
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
                  Pague a entrada de {formatBRL(pricing.depositAmount)} via PIX. A
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
                Reserva enviada. Pague a entrada de{" "}
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
              {pet.name} está agendado{" "}
              {isDaycare
                ? startDate === endDate
                  ? formatDate(startDate)
                  : `${formatDate(startDate)} a ${formatDate(endDate)}`
                : formatBookingWhen(
                    startDate,
                    isAppointment ? startDate : endDate,
                    isAppointment ? slotTime : null,
                  )}
              . A confirmação foi enviada no WhatsApp de {tutor.name}.
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

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`min-h-11 rounded-xl border text-sm ${
            value === true
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "hover:bg-muted"
          }`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`min-h-11 rounded-xl border text-sm ${
            value === false
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "hover:bg-muted"
          }`}
        >
          Não
        </button>
      </div>
    </div>
  );
}
