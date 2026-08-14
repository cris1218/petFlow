"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createTenantService,
  deleteTenantService,
  updateTenantService,
} from "@/actions/settings";
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
import { SERVICE_KIND_LABELS, type ServiceKind } from "@/lib/schedule";
import { cn, formatBRL } from "@/lib/utils";

export type HotelServiceItem = {
  id: string;
  name: string;
  price: number;
  kind: ServiceKind;
  active: boolean;
};

export function HotelServicesForm({
  initial,
}: {
  initial: HotelServiceItem[];
}) {
  const [services, setServices] = useState(initial);
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
      const result = await updateTenantService({
        id: service.id,
        name: patch.name ?? service.name,
        price: patch.price ?? service.price,
        active: patch.active ?? service.active,
        kind: patch.kind ?? service.kind,
      });
      if (!result.ok) {
        setError(result.error);
        toastError(result.error);
        return;
      }
      setServices((current) =>
        current.map((item) => (item.id === service.id ? result.service : item)),
      );
      success();
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
      <div className="space-y-3">
        {services.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Cadastre os serviços que o hotel oferece. Só os ativos aparecem na
            reserva.
          </p>
        )}
        {services.map((service) => (
          <div
            key={service.id}
            className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_8rem_minmax(11rem,auto)_auto_auto] sm:items-end"
          >
            <div className="space-y-1.5">
              <Label>Serviço</Label>
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
              <Label>{service.kind === "APPOINTMENT" ? "Valor" : "Valor / diária"}</Label>
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
              <Label>Agenda</Label>
              <Select
                value={service.kind}
                onValueChange={(value) =>
                  saveRow(service, { kind: value as ServiceKind })
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
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-dashed p-3 sm:grid-cols-[1fr_8rem_minmax(11rem,auto)_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="new-service">Novo serviço</Label>
          <Input
            id="new-service"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Petsitter, Hotel, Banho e tosa"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-price">Valor</Label>
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
          <Label>Agenda</Label>
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
          Na reserva o cliente vê:{" "}
          {services
            .filter((service) => service.active)
            .map((service) => `${service.name} (${formatBRL(service.price)})`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
