"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { checkInBooking, checkOutBooking } from "@/actions/bookings";
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
import { formatDate } from "@/lib/utils";

export type CheckInBooking = {
  id: string;
  petName: string;
  tutorName: string;
  startDate: Date | string;
  endDate: Date | string;
  status: "CONFIRMED" | "CHECKED_IN" | string;
  expiredVaccines: string[];
  checklist: Array<{ id: string; itemName: string; quantity: number }>;
};

const DEFAULT_ITEMS = ["Ração 2kg", "Medicação", "Coleira", "Cama / toalha"];

export function CheckInForm({ bookings }: { bookings: CheckInBooking[] }) {
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [items, setItems] = useState(
    DEFAULT_ITEMS.map((itemName) => ({ itemName, quantity: 1, enabled: false })),
  );
  const [customItem, setCustomItem] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = bookings.find((booking) => booking.id === bookingId);

  function submitCheckIn() {
    if (!bookingId) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
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
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const vaccineWarning =
        result.expiredVaccines.length > 0
          ? ` Atenção: vacinas vencidas (${result.expiredVaccines.join(", ")}).`
          : "";
      setMessage(`Check-in realizado.${vaccineWarning}`);
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
      setMessage("Check-out concluído. Pertences marcados como devolvidos.");
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
        <CardTitle>Check-in de pertences e vacinas</CardTitle>
        <CardDescription>
          Liste o que o tutor trouxe e verifique a carteira de vacinação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="booking">Reserva</Label>
          <select
            id="booking"
            value={bookingId}
            onChange={(event) => setBookingId(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.petName} · {booking.tutorName} · {booking.status}
              </option>
            ))}
          </select>
          {selected && (
            <p className="text-xs text-muted-foreground">
              {formatDate(selected.startDate)} até {formatDate(selected.endDate)}
            </p>
          )}
        </div>

        {selected && selected.expiredVaccines.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Vacinas vencidas</p>
              <p>{selected.expiredVaccines.join(", ")}</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Pertences</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item, index) => (
              <label
                key={item.itemName}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
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
                  className="h-8 w-16"
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

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={submitCheckIn}
            disabled={isPending || selected?.status === "CHECKED_IN"}
          >
            Confirmar check-in
          </Button>
          <Button
            variant="outline"
            onClick={submitCheckOut}
            disabled={isPending || selected?.status !== "CHECKED_IN"}
          >
            Fazer check-out
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-accent">{message}</p>}
      </CardContent>
    </Card>
  );
}
