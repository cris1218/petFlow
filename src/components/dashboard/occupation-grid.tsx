import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BOOKING_STATUS_LABELS, serviceLabel } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

type Stay = {
  id: string;
  petName: string;
  tutorName: string;
  serviceType: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

function StayList({
  title,
  description,
  stays,
  empty,
}: {
  title: string;
  description: string;
  stays: Stay[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {stays.length === 0 && (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
        {stays.map((stay) => (
          <div
            key={stay.id}
            className="flex items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">{stay.petName}</p>
              <p className="text-sm text-muted-foreground">{stay.tutorName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(stay.startDate)} → {formatDate(stay.endDate)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant="secondary">
                {serviceLabel(stay.serviceType)}
              </Badge>
              <Badge variant="outline">
                {BOOKING_STATUS_LABELS[
                  stay.status as keyof typeof BOOKING_STATUS_LABELS
                ] ?? stay.status}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function OccupationGrid({
  checkIns,
  checkOuts,
  inHouse,
}: {
  checkIns: Stay[];
  checkOuts: Stay[];
  inHouse: Stay[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <StayList
        title="Check-ins de hoje"
        description="Reservas que entram hoje."
        stays={checkIns}
        empty="Nenhum check-in previsto."
      />
      <StayList
        title="Check-outs de hoje"
        description="Pets que saem hoje."
        stays={checkOuts}
        empty="Nenhum check-out previsto."
      />
      <StayList
        title="Hospedados agora"
        description="Ocupação atual do hotel."
        stays={inHouse}
        empty="Nenhum pet hospedado."
      />
    </div>
  );
}
