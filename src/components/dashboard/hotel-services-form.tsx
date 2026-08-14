"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  createTenantService,
  deleteTenantService,
  updateTenantService,
} from "@/actions/settings";
import { WeekdayHoursEditor } from "@/components/dashboard/weekday-hours";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { useFeedback } from "@/components/app-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SERVICE_KIND_LABELS,
  defaultWeekdays,
  type ServiceKind,
  type WeekdayHours,
} from "@/lib/schedule";
import { cn, formatBRL } from "@/lib/utils";

export type HotelServiceItem = {
  id: string;
  name: string;
  price: number;
  kind: ServiceKind;
  active: boolean;
  dailyCutoffTime: string;
  depositAmount: number | null;
  catCapacity: number;
  dogCapacity: number;
  periodCapacity: number;
  slotDurationMin: number;
  slotCapacity: number;
  weekdays: WeekdayHours[];
};

function priceLabel(kind: ServiceKind) {
  if (kind === "APPOINTMENT") return "Quanto custa o atendimento";
  if (kind === "DAYCARE") return "Quanto custa o dia";
  return "Quanto custa a diária";
}

export function HotelServicesForm({
  initial,
}: {
  initial: HotelServiceItem[];
}) {
  const [services, setServices] = useState(initial);
  const [weekdayDrafts, setWeekdayDrafts] = useState<Record<string, WeekdayHours[]>>({});
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<ServiceKind>("STAY");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useFeedback();

  function addService() {
    startTransition(async () => {
      setError(null);
      const result = await createTenantService({
        name,
        price: Number(price),
        kind,
      });
      if (!result.ok) {
        setError(result.error);
        toastError(result.error);
        return;
      }
      setServices((current) => [...current, result.service]);
      setName("");
      setPrice("");
      setKind("STAY");
      success("Serviço cadastrado.");
    });
  }

  function saveRow(service: HotelServiceItem, patch: Partial<HotelServiceItem>) {
    startTransition(async () => {
      setError(null);
      const nextKind = patch.kind ?? service.kind;
      const result = await updateTenantService({
        id: service.id,
        name: patch.name ?? service.name,
        price: patch.price ?? service.price,
        active: patch.active ?? service.active,
        kind: nextKind,
        dailyCutoffTime: patch.dailyCutoffTime ?? service.dailyCutoffTime,
        depositAmount:
          patch.depositAmount !== undefined ? patch.depositAmount : service.depositAmount,
        catCapacity: patch.catCapacity ?? service.catCapacity,
        dogCapacity: patch.dogCapacity ?? service.dogCapacity,
        periodCapacity: patch.periodCapacity ?? service.periodCapacity,
        slotDurationMin: patch.slotDurationMin ?? service.slotDurationMin,
        slotCapacity: patch.slotCapacity ?? service.slotCapacity,
        weekdays:
          nextKind === "STAY"
            ? undefined
            : patch.weekdays ?? weekdayDrafts[service.id] ?? service.weekdays,
      });
      if (!result.ok) {
        setError(result.error);
        toastError(result.error);
        return;
      }
      setServices((current) =>
        current.map((item) => (item.id === service.id ? result.service : item)),
      );
      if (result.service.weekdays) {
        setWeekdayDrafts((current) => ({
          ...current,
          [service.id]: result.service.weekdays,
        }));
      }
      success("Agenda salva.");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      setError(null);
      const result = await deleteTenantService(id);
      if (!result.ok) {
        setError(result.error);
        toastError(result.error);
        return;
      }
      setServices((current) => current.filter((item) => item.id !== id));
      success("Serviço removido.");
    });
  }

  return (
    <div className="space-y-4">
      {services.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Ainda não tem serviço. Cadastre hotel, creche ou banho e tosa abaixo.
        </p>
      )}
      {services.map((service) => (
        <SettingsSection
          key={service.id}
          title={service.name}
          description={
            service.kind === "STAY"
              ? "Pernoite. Diga o preço do dia, a entrada, até que horas pode sair e quantos pets cabem."
              : service.kind === "DAYCARE"
                ? "O pet passa o dia, sem pernoite. Diga o preço, quantos cabem e os dias de atendimento."
                : "Hora marcada. Diga o preço, quanto tempo leva e em quais dias atende."
          }
          extra={
            <Badge variant={service.active ? "success" : "secondary"}>
              {service.active ? "Ativo" : "Pausado"}
            </Badge>
          }
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_minmax(11rem,auto)_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                defaultValue={service.name}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next && next !== service.name) {
                    saveRow(service, { name: next });
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{priceLabel(service.kind)}</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                defaultValue={String(service.price)}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next > 0 && next !== service.price) {
                    saveRow(service, { price: next });
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={service.kind}
                onValueChange={(value) =>
                  saveRow(service, {
                    kind: value as ServiceKind,
                    weekdays: service.weekdays.length ? service.weekdays : defaultWeekdays(),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_KIND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={service.active}
              disabled={isPending}
              onClick={() => saveRow(service, { active: !service.active })}
              className="flex h-11 w-full items-center justify-between gap-3 rounded-md border px-3 text-sm sm:w-auto"
            >
              <Badge variant={service.active ? "success" : "secondary"}>
                {service.active ? "Ativo" : "Inativo"}
              </Badge>
              <span
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  service.active ? "bg-accent" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    service.active ? "left-[22px]" : "left-0.5",
                  )}
                />
              </span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              loading={isPending}
              onClick={() => remove(service.id)}
              aria-label={`Excluir ${service.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {service.kind === "STAY" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Quanto o tutor paga agora</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={String(service.depositAmount ?? "")}
                  placeholder="Ex.: 50"
                  onBlur={(event) => {
                    const raw = event.target.value.trim();
                    const next = raw === "" ? null : Number(raw);
                    if (next !== service.depositAmount) {
                      saveRow(service, { depositAmount: next });
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Se deixar vazio, o tutor não precisa pagar entrada agora.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Até que horas a diária vale</Label>
                <Input
                  type="time"
                  defaultValue={service.dailyCutoffTime || "12:00"}
                  onBlur={(event) => {
                    if (event.target.value !== service.dailyCutoffTime) {
                      saveRow(service, { dailyCutoffTime: event.target.value });
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Se o pet sair depois desse horário, cobra mais um dia.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Quantos gatos no mesmo dia</Label>
                <Input
                  type="number"
                  min="0"
                  max="200"
                  defaultValue={String(service.catCapacity)}
                  onBlur={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next) && next !== service.catCapacity) {
                      saveRow(service, { catCapacity: next });
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quantos cães no mesmo dia</Label>
                <Input
                  type="number"
                  min="0"
                  max="200"
                  defaultValue={String(service.dogCapacity)}
                  onBlur={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next) && next !== service.dogCapacity) {
                      saveRow(service, { dogCapacity: next });
                    }
                  }}
                />
              </div>
            </div>
          ) : null}

          {service.kind === "DAYCARE" ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Quantos pets cabem no dia</Label>
                  <Input
                    type="number"
                    min="1"
                    max="200"
                    defaultValue={String(service.periodCapacity)}
                    onBlur={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next) && next !== service.periodCapacity) {
                        saveRow(service, { periodCapacity: next });
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    É o limite da creche no mesmo horário.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Quanto o tutor paga agora</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={String(service.depositAmount ?? "")}
                    placeholder="Ex.: 50"
                    onBlur={(event) => {
                      const raw = event.target.value.trim();
                      const next = raw === "" ? null : Number(raw);
                      if (next !== service.depositAmount) {
                        saveRow(service, { depositAmount: next });
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se deixar vazio, o tutor não precisa pagar entrada agora.
                  </p>
                </div>
              </div>
              <WeekdayHoursEditor
                weekdays={weekdayDrafts[service.id] ?? service.weekdays}
                onChange={(weekdays) =>
                  setWeekdayDrafts((current) => ({ ...current, [service.id]: weekdays }))
                }
              />
            </div>
          ) : null}

          {service.kind === "APPOINTMENT" ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Quanto tempo dura cada atendimento</Label>
                  <Input
                    type="number"
                    min="15"
                    max="240"
                    step="15"
                    defaultValue={String(service.slotDurationMin)}
                    onBlur={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next) && next !== service.slotDurationMin) {
                        saveRow(service, { slotDurationMin: next });
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Em minutos. Ex.: 30 abre horários de meia em meia hora.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Quantos pets no mesmo horário</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    defaultValue={String(service.slotCapacity)}
                    onBlur={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next) && next !== service.slotCapacity) {
                        saveRow(service, { slotCapacity: next });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Quanto o tutor paga agora</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={String(service.depositAmount ?? "")}
                    placeholder="Ex.: 50"
                    onBlur={(event) => {
                      const raw = event.target.value.trim();
                      const next = raw === "" ? null : Number(raw);
                      if (next !== service.depositAmount) {
                        saveRow(service, { depositAmount: next });
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se deixar vazio, o tutor não precisa pagar entrada agora.
                  </p>
                </div>
              </div>
              <WeekdayHoursEditor
                weekdays={weekdayDrafts[service.id] ?? service.weekdays}
                onChange={(weekdays) =>
                  setWeekdayDrafts((current) => ({ ...current, [service.id]: weekdays }))
                }
              />
            </div>
          ) : null}

          {service.kind !== "STAY" ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              loading={isPending}
              onClick={() =>
                saveRow(service, {
                  weekdays: weekdayDrafts[service.id] ?? service.weekdays,
                })
              }
            >
              <Save className="h-4 w-4" />
              Salvar agenda
            </Button>
          ) : null}
        </SettingsSection>
      ))}

      <div className="grid gap-3 rounded-xl border border-dashed p-3 sm:grid-cols-[1fr_8rem_minmax(11rem,auto)_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="new-service">Nome do serviço</Label>
          <Input
            id="new-service"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Hotel, Creche, Petsitter, Banho e tosa"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-price">Preço</Label>
          <Input
            id="new-price"
            type="number"
            min="1"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="80"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={kind} onValueChange={(value) => setKind(value as ServiceKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SERVICE_KIND_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" className="w-full sm:w-auto" loading={isPending} onClick={addService}>
          <Plus className="h-4 w-4" />
          Cadastrar
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {services.some((service) => service.active) && (
        <p className="text-xs text-muted-foreground">
          O cliente vê na agenda:{" "}
          {services
            .filter((service) => service.active)
            .map((service) => `${service.name} (${formatBRL(service.price)})`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
