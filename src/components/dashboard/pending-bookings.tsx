"use client";

import { useTransition } from "react";
import { markBookingPaid } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatBRL, formatDate } from "@/lib/utils";
import { ServiceType } from "@prisma/client";

type PendingBooking = {
  id: string;
  petName: string;
  tutorName: string;
  tutorPhone: string;
  serviceType: string;
  startDate: Date;
  endDate: Date;
  depositAmount: number;
  paymentStatus: string;
};

export function PendingBookings({ bookings }: { bookings: PendingBooking[] }) {
  const [isPending, startTransition] = useTransition();

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
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div>
              <p className="font-medium">{booking.petName}</p>
              <p className="text-sm text-muted-foreground">
                {booking.tutorName} · {booking.tutorPhone}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(booking.startDate)} → {formatDate(booking.endDate)} ·
                sinal {formatBRL(booking.depositAmount)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="secondary">
                {SERVICE_LABELS[booking.serviceType as ServiceType] ??
                  booking.serviceType}
              </Badge>
              <Button
                size="sm"
                onClick={() =>
                  startTransition(async () => {
                    await markBookingPaid(booking.id);
                  })
                }
                disabled={isPending}
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
