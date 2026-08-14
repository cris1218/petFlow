"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { saveHotelSchedule } from "@/actions/schedule";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { PET_SIZES, SIZE_LABELS, type PetSize } from "@/lib/constants";

export type HotelScheduleValues = {
  acceptsCats: boolean;
  acceptsCatSmall: boolean;
  acceptsCatMedium: boolean;
  acceptsCatLarge: boolean;
  acceptsDogSmall: boolean;
  acceptsDogMedium: boolean;
  acceptsDogLarge: boolean;
};

function SizeToggles({
  values,
  onChange,
}: {
  values: Record<PetSize, boolean>;
  onChange: (size: PetSize, checked: boolean) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {PET_SIZES.map((size) => (
        <label
          key={size}
          className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm"
        >
          <input
            type="checkbox"
            checked={values[size]}
            onChange={(event) => onChange(size, event.target.checked)}
          />
          {SIZE_LABELS[size]}
        </label>
      ))}
    </div>
  );
}

export function HotelScheduleForm({ initial }: { initial: HotelScheduleValues }) {
  const [catSizes, setCatSizes] = useState({
    SMALL: initial.acceptsCats && initial.acceptsCatSmall,
    MEDIUM: initial.acceptsCats && initial.acceptsCatMedium,
    LARGE: initial.acceptsCats && initial.acceptsCatLarge,
  });
  const [dogSizes, setDogSizes] = useState({
    SMALL: initial.acceptsDogSmall,
    MEDIUM: initial.acceptsDogMedium,
    LARGE: initial.acceptsDogLarge,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useFeedback();

  function save() {
    startTransition(async () => {
      setError(null);
      const result = await saveHotelSchedule({
        acceptsCatSmall: catSizes.SMALL,
        acceptsCatMedium: catSizes.MEDIUM,
        acceptsCatLarge: catSizes.LARGE,
        acceptsDogSmall: dogSizes.SMALL,
        acceptsDogMedium: dogSizes.MEDIUM,
        acceptsDogLarge: dogSizes.LARGE,
      });
      if (!result.ok) {
        setError(result.error);
        toastError(result.error);
        return;
      }
      success("Preferências salvas.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">Tamanho dos gatos</p>
        <p className="text-xs text-muted-foreground">
          Só aparece na reserva o que estiver marcado.
        </p>
        <SizeToggles
          values={catSizes}
          onChange={(size, checked) =>
            setCatSizes((current) => ({ ...current, [size]: checked }))
          }
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Tamanho dos cães</p>
        <p className="text-xs text-muted-foreground">
          Pequeno, médio ou grande — marque o que vocês recebem.
        </p>
        <SizeToggles
          values={dogSizes}
          onChange={(size, checked) =>
            setDogSizes((current) => ({ ...current, [size]: checked }))
          }
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" className="w-full sm:w-auto" loading={isPending} onClick={save}>
        <Save className="h-4 w-4" />
        Salvar
      </Button>
    </div>
  );
}
