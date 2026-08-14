"use client";

import { useTransition } from "react";
import { markBookingPaid } from "@/actions/bookings";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { catCareLabels, hasPetCareProfile, serviceLabel } from "@/lib/constants";
import { formatBRL, formatBookingWhen, formatWhatsAppMask } from "@/lib/utils";

type PendingBooking = {
  id: string;
  petName: string;
  species?: string;
  castrated?: boolean | null;
  vaccinated?: boolean | null;
  aggressive?: boolean | null;
  tutorName: string;
  tutorPhone: string;
  serviceType: string;
  startDate: Date;
  endDate: Date;
  slotTime?: string | null;
  depositAmount: number;
  paymentStatus: string;
};

export function PendingBookings({ bookings }: { bookings: PendingBooking[] }) {
  const [isPending, startTransition] = useTransition();
  const { success, error } = useFeedback();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aguardando confirmação</CardTitle>
        <CardDescription>
          Reservas ainda pendentes. Confirme o pagamento quando o tutor pagar no
          hotel ou via PIX.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma reserva pendente.</p>
        )}
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium">{booking.petName}</p>
              <p className="text-sm text-muted-foreground">
                {booking.tutorName} · {formatWhatsAppMask(booking.tutorPhone)}
              </p>
              {hasPetCareProfile(booking.species) ? (
                <p className="text-xs text-muted-foreground">
                  {catCareLabels(booking).join(" · ")}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {formatBookingWhen(booking.startDate, booking.endDate, booking.slotTime)} ·
                sinal {formatBRL(booking.depositAmount)}
              </p>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <Badge variant="secondary" className="w-fit">
                {serviceLabel(booking.serviceType)}
              </Badge>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() =>
                  startTransition(async () => {
                    const result = await markBookingPaid(booking.id);
                    if (!result.ok) {
                      error(result.error ?? "Não foi possível confirmar.");
                      return;
                    }
                    success("Reserva confirmada com sucesso.");
                  })
                }
                loading={isPending}
              >
                Confirmar e marcar pago
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
