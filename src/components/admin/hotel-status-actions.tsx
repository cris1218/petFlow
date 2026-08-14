"use client";

import { useTransition } from "react";
import { TenantStatus } from "@prisma/client";
import { deleteHotel, setHotelStatus } from "@/actions/admin";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";

export function HotelStatusActions({
  tenantId,
  hotelName,
  status,
}: {
  tenantId: string;
  hotelName: string;
  status: TenantStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const { success, error } = useFeedback();

  function confirmDelete() {
    const typed = window.prompt(
      `Isso apaga o hotel, gestores, tutores, pets, reservas, diário e a instância WhatsApp.\n\nDigite o nome do hotel para confirmar:\n${hotelName}`,
    );
    if (typed?.trim() !== hotelName) return;
    startTransition(async () => {
      const result = await deleteHotel(tenantId);
      if (!result.ok) {
        error(result.error);
        return;
      }
      success("Hotel excluído com sucesso.");
    });
  }

  return (
    <>
      {status === "SUSPENDED" ? (
        <Button
          size="sm"
          variant="outline"
          loading={isPending}
          onClick={() =>
            startTransition(async () => {
              await setHotelStatus(tenantId, "ACTIVE");
              success("Hotel reativado com sucesso.");
            })
          }
        >
          Reativar
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          loading={isPending}
          onClick={() =>
            startTransition(async () => {
              await setHotelStatus(tenantId, "SUSPENDED");
              success("Hotel suspenso com sucesso.");
            })
          }
        >
          Suspender
        </Button>
      )}
      <Button
        size="sm"
        variant="destructive"
        loading={isPending}
        onClick={confirmDelete}
      >
        Excluir
      </Button>
    </>
  );
}
