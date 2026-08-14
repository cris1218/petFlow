"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  type WeekdayHours,
} from "@/lib/schedule";

export function WeekdayHoursEditor({
  weekdays,
  onChange,
}: {
  weekdays: WeekdayHours[];
  onChange: (weekdays: WeekdayHours[]) => void;
}) {
  const ordered = WEEKDAY_ORDER.map(
    (weekday) =>
      weekdays.find((day) => day.weekday === weekday) ?? {
        weekday,
        openTime: "08:00",
        closeTime: "18:00",
        closed: weekday === 0,
      },
  );

  function patchDay(weekday: number, patch: Partial<WeekdayHours>) {
    onChange(
      ordered.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }

  return (
    <div className="space-y-2">
      <Label>Dias e horário de funcionamento</Label>
      <p className="text-xs text-muted-foreground">
        Marque os dias em que atende e o horário de abrir e fechar.
      </p>
      <div className="space-y-2">
        {ordered.map((day) => (
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
  );
}
