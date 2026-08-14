"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { BOOKING_STATUS_LABELS, catCareLabels, hasPetCareProfile } from "@/lib/constants";
import { useFeedback } from "@/components/app-feedback";

export type CheckInBooking = {
  id: string;
  petName: string;
  tutorName: string;
  startDate: Date | string;
  endDate: Date | string;
  status: "CONFIRMED" | "CHECKED_IN" | string;
  species?: string;
  castrated?: boolean | null;
  vaccinated?: boolean | null;
  aggressive?: boolean | null;
  checklist: Array<{ id: string; itemName: string; quantity: number }>;
};

type CatalogItem = { id: string; name: string };

const EMPTY_BELONGINGS: CatalogItem[] = [];

export function CheckInForm({
  bookings,
  belongings = EMPTY_BELONGINGS,
  mode,
}: {
  bookings: CheckInBooking[];
  belongings?: CatalogItem[];
  mode: "check-in" | "check-out";
}) {
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [items, setItems] = useState(
    belongings.map((item) => ({ itemName: item.name, quantity: 1, enabled: false })),
  );
  const [customItem, setCustomItem] = useState("");
  const [returnedIds, setReturnedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success } = useFeedback();
  const isCheckOut = mode === "check-out";

  const selected = bookings.find((booking) => booking.id === bookingId);
  const allReturned =
    !selected?.checklist.length ||
    selected.checklist.every((item) => returnedIds.includes(item.id));

  useEffect(() => {
    if (!bookings.some((booking) => booking.id === bookingId)) {
      setBookingId(bookings[0]?.id ?? "");
    }
  }, [bookings, bookingId]);

  useEffect(() => {
    setItems(
      belongings.map((item) => ({ itemName: item.name, quantity: 1, enabled: false })),
    );
    setCustomItem("");
  }, [bookingId, belongings]);

  useEffect(() => {
    setReturnedIds([]);
    setError(null);
  }, [bookingId]);

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
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      success("Entrada salva com sucesso.");
    });
  }

  function submitCheckOut() {
    if (!bookingId) return;
    if (!allReturned) {
      setError("Marque todos os pertences devolvidos para liberar a saída.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await checkOutBooking(bookingId, returnedIds);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      success("Saída salva com sucesso.");
    });
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {isCheckOut ? "Nenhum pet para dar saída" : "Nenhuma reserva para dar entrada"}
          </CardTitle>
          <CardDescription>
            {isCheckOut
              ? "Pets com entrada registrada aparecem aqui até o tutor buscar."
              : "Confirme um agendamento para liberar a entrada."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isCheckOut ? "Registrar saída" : "Registrar entrada"}</CardTitle>
        <CardDescription>
          {isCheckOut
            ? "Marque cada pertence devolvido ao tutor para liberar a saída."
            : "Marque os pertences que chegaram com o pet."}
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
                  {booking.petName} · {booking.tutorName} ·{" "}
                  {BOOKING_STATUS_LABELS[
                    booking.status as keyof typeof BOOKING_STATUS_LABELS
                  ] ?? booking.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <p className="text-xs text-muted-foreground">
              {formatDate(selected.startDate)} até {formatDate(selected.endDate)}
              {hasPetCareProfile(selected.species)
                ? ` · ${catCareLabels(selected).join(" · ")}`
                : ""}
            </p>
          )}
        </div>

        {!isCheckOut ? (
          <div className="space-y-2">
            <Label>Pertences</Label>
            {belongings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Cadastre os pertences acima para marcá-los na entrada.
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
        ) : (
          <div className="space-y-2">
            <Label>Pertences para devolver</Label>
            {selected?.checklist.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {selected.checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0"
                      checked={returnedIds.includes(item.id)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setReturnedIds((current) => {
                          if (checked) {
                            return current.includes(item.id)
                              ? current
                              : [...current, item.id];
                          }
                          return current.filter((id) => id !== item.id);
                        });
                      }}
                    />
                    {item.itemName} × {item.quantity}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum pertence foi registrado na entrada.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap">
          {isCheckOut ? (
            <Button
              className="w-full sm:w-auto"
              onClick={submitCheckOut}
              loading={isPending}
              disabled={!allReturned}
            >
              {isPending ? "Salvando..." : "Dar saída"}
            </Button>
          ) : (
            <Button
              className="w-full sm:w-auto"
              onClick={submitCheckIn}
              loading={isPending}
            >
              {isPending ? "Salvando..." : "Dar entrada"}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
