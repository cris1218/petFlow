"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { checkInBooking, checkOutBooking } from "@/actions/bookings";
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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { useFeedback } from "@/components/app-feedback";

export type CheckInBooking = {
  id: string;
  petName: string;
  tutorName: string;
  startDate: Date | string;
  endDate: Date | string;
  status: "CONFIRMED" | "CHECKED_IN" | string;
  petVaccines: string[];
  checklist: Array<{ id: string; itemName: string; quantity: number }>;
};

type CatalogItem = { id: string; name: string };

export function CheckInForm({
  bookings,
  belongings,
  requiredVaccines,
}: {
  bookings: CheckInBooking[];
  belongings: CatalogItem[];
  requiredVaccines: CatalogItem[];
}) {
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [items, setItems] = useState(
    belongings.map((item) => ({ itemName: item.name, quantity: 1, enabled: false })),
  );
  const [hasVaccines, setHasVaccines] = useState<string[]>([]);
  const [customItem, setCustomItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success } = useFeedback();

  const selected = bookings.find((booking) => booking.id === bookingId);
  const missingVaccines = requiredVaccines
    .map((vaccine) => vaccine.name)
    .filter((name) => !hasVaccines.includes(name));

  useEffect(() => {
    setItems(
      belongings.map((item) => ({ itemName: item.name, quantity: 1, enabled: false })),
    );
    const booking = bookings.find((row) => row.id === bookingId);
    setHasVaccines(booking?.petVaccines ?? []);
    setCustomItem("");
  }, [bookingId, belongings, bookings]);

  function toggleVaccine(name: string, checked: boolean) {
    setHasVaccines((current) =>
      checked
        ? current.includes(name)
          ? current
          : [...current, name]
        : current.filter((item) => item !== name),
    );
  }

  function submitCheckIn() {
    if (!bookingId) return;
    startTransition(async () => {
      setError(null);
      const result = await checkInBooking({
        bookingId,
        items: [
          ...items
            .filter((item) => item.enabled && item.itemName)
            .map(({ itemName, quantity }) => ({ itemName, quantity })),
          ...(customItem.trim()
            ? [{ itemName: customItem.trim(), quantity: 1 }]
            : []),
        ],
        vaccineNames: hasVaccines,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      success(
        result.missingVaccines.length > 0
          ? `Check-in salvo. Faltam vacinas: ${result.missingVaccines.join(", ")}.`
          : "Check-in salvo com sucesso.",
      );
    });
  }

  function submitCheckOut() {
    if (!bookingId) return;
    startTransition(async () => {
      const result = await checkOutBooking(bookingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      success("Check-out salvo com sucesso.");
    });
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhuma reserva ativa</CardTitle>
          <CardDescription>
            Confirme um agendamento para liberar o check-in.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fazer check-in</CardTitle>
        <CardDescription>
          Marque os pertences que chegaram e as vacinas que o pet tem. Sem data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="booking">Reserva</Label>
          <Select value={bookingId} onValueChange={setBookingId}>
            <SelectTrigger id="booking">
              <SelectValue placeholder="Escolha a reserva" />
            </SelectTrigger>
            <SelectContent>
              {bookings.map((booking) => (
                <SelectItem key={booking.id} value={booking.id}>
                  {booking.petName} · {booking.tutorName} · {booking.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <p className="text-xs text-muted-foreground">
              {formatDate(selected.startDate)} até {formatDate(selected.endDate)}
            </p>
          )}
        </div>

        {requiredVaccines.length > 0 && (
          <div className="space-y-2">
            <Label>Vacinas</Label>
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
                      toggleVaccine(vaccine.name, event.target.checked)
                    }
                  />
                  {vaccine.name}
                </label>
              ))}
            </div>
            {missingVaccines.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Ainda faltam: {missingVaccines.join(", ")}.</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Pertences</Label>
          {belongings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre os pertences acima para marcá-los no check-in.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((item, index) => (
                <label
                  key={item.itemName}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) => {
                        const next = [...items];
                        next[index] = { ...item, enabled: event.target.checked };
                        setItems(next);
                      }}
                    />
                    {item.itemName}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    className="h-10 w-16"
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = {
                        ...item,
                        quantity: Number(event.target.value) || 1,
                      };
                      setItems(next);
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          <Input
            placeholder="Outro item (ex.: Brinquedo favorito)"
            value={customItem}
            onChange={(event) => setCustomItem(event.target.value)}
          />
        </div>

        {selected?.checklist.length ? (
          <div className="flex flex-wrap gap-2">
            {selected.checklist.map((item) => (
              <Badge key={item.id} variant="secondary">
                {item.itemName} × {item.quantity}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap">
          <Button
            className="w-full sm:w-auto"
            onClick={submitCheckIn}
            loading={isPending}
            disabled={selected?.status === "CHECKED_IN"}
          >
            {isPending ? "Salvando..." : "Confirmar check-in"}
          </Button>
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            onClick={submitCheckOut}
            loading={isPending}
            disabled={selected?.status !== "CHECKED_IN"}
          >
            {isPending ? "Salvando..." : "Fazer check-out"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
