"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { saveHotelSchedule } from "@/actions/schedule";
import { useFeedback } from "@/components/app-feedback";
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
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  type WeekdayHours,
} from "@/lib/schedule";
import { SIZE_LABELS } from "@/lib/constants";

export type HotelScheduleValues = {
  stayCapacity: number;
  appointmentCapacity: number;
  slotDurationMin: number;
  acceptsCats: boolean;
  acceptsDogSmall: boolean;
  acceptsDogMedium: boolean;
  acceptsDogLarge: boolean;
  weekdays: WeekdayHours[];
};

export function HotelScheduleForm({ initial }: { initial: HotelScheduleValues }) {
  const [stayCapacity, setStayCapacity] = useState(String(initial.stayCapacity));
  const [appointmentCapacity, setAppointmentCapacity] = useState(
    String(initial.appointmentCapacity),
  );
  const [slotDurationMin, setSlotDurationMin] = useState(
    String(initial.slotDurationMin),
  );
  const [acceptsCats, setAcceptsCats] = useState(initial.acceptsCats);
  const [dogSizes, setDogSizes] = useState({
    SMALL: initial.acceptsDogSmall,
    MEDIUM: initial.acceptsDogMedium,
    LARGE: initial.acceptsDogLarge,
  });
  const [weekdays, setWeekdays] = useState<WeekdayHours[]>(() =>
    WEEKDAY_ORDER.map(
      (weekday) =>
        initial.weekdays.find((day) => day.weekday === weekday) ?? {
          weekday,
          openTime: "08:00",
          closeTime: "18:00",
          closed: weekday === 0,
        },
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useFeedback();

  function patchDay(weekday: number, patch: Partial<WeekdayHours>) {
    setWeekdays((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }

  function save() {
    startTransition(async () => {
      setError(null);
      const result = await saveHotelSchedule({
        stayCapacity: Number(stayCapacity),
        appointmentCapacity: Number(appointmentCapacity),
        slotDurationMin: Number(slotDurationMin),
        acceptsCats,
        acceptsDogSmall: dogSizes.SMALL,
        acceptsDogMedium: dogSizes.MEDIUM,
        acceptsDogLarge: dogSizes.LARGE,
        weekdays,
      });
      if (!result.ok) {
        setError(result.error);
        toastError(result.error);
        return;
      }
      success("Agenda salva.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda e horários</CardTitle>
        <CardDescription>
          Hotel e creche usam a capacidade de vagas. Banho e tosa usa horários:
          um cliente não agenda no mesmo dia e hora de outro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="stay-capacity">Vagas hotel / creche</Label>
            <Input
              id="stay-capacity"
              type="number"
              min={1}
              max={200}
              value={stayCapacity}
              onChange={(event) => setStayCapacity(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pets ao mesmo tempo na estadia.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-duration">Duração do horário (min)</Label>
            <Input
              id="slot-duration"
              type="number"
              min={15}
              max={240}
              step={15}
              value={slotDurationMin}
              onChange={(event) => setSlotDurationMin(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ex.: 60 gera 08:00, 09:00, 10:00...
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="appt-capacity">Atendimentos por horário</Label>
            <Input
              id="appt-capacity"
              type="number"
              min={1}
              max={20}
              value={appointmentCapacity}
              onChange={(event) => setAppointmentCapacity(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              1 = um pet por horário de banho e tosa.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border p-3">
          <div>
            <p className="text-sm font-medium">Quem o hotel atende</p>
            <p className="text-xs text-muted-foreground">
              Gato só entra como porte pequeno. Cão pode ser pequeno, médio ou
              grande — marque o que vocês aceitam.
            </p>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptsCats}
              onChange={(event) => setAcceptsCats(event.target.checked)}
            />
            Atende gatos (porte pequeno)
          </label>
          <div className="space-y-2">
            <p className="text-sm">Portes de cão</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(SIZE_LABELS) as Array<keyof typeof SIZE_LABELS>).map(
                (size) => (
                  <label
                    key={size}
                    className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={dogSizes[size]}
                      onChange={(event) =>
                        setDogSizes((current) => ({
                          ...current,
                          [size]: event.target.checked,
                        }))
                      }
                    />
                    {SIZE_LABELS[size]}
                  </label>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Funcionamento</Label>
          <div className="space-y-2">
            {weekdays.map((day) => (
              <div
                key={day.weekday}
                className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[7rem_auto_1fr_1fr] sm:items-center"
              >
                <p className="text-sm font-medium">{WEEKDAY_LABELS[day.weekday]}</p>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!day.closed}
                    onChange={(event) =>
                      patchDay(day.weekday, { closed: !event.target.checked })
                    }
                  />
                  Aberto
                </label>
                <Input
                  type="time"
                  value={day.openTime}
                  disabled={day.closed}
                  onChange={(event) =>
                    patchDay(day.weekday, { openTime: event.target.value })
                  }
                />
                <Input
                  type="time"
                  value={day.closeTime}
                  disabled={day.closed}
                  onChange={(event) =>
                    patchDay(day.weekday, { closeTime: event.target.value })
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" className="w-full sm:w-auto" loading={isPending} onClick={save}>
          <Save className="h-4 w-4" />
          Salvar agenda
        </Button>
      </CardContent>
    </Card>
  );
}
