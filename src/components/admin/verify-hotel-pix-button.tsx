"use client";

import { useTransition } from "react";
import { verifyHotelSubscriptionPix } from "@/actions/billing";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";

export function VerifyHotelPixButton({ tenantId }: { tenantId: string }) {
  const [isPending, startTransition] = useTransition();
  const { success, error } = useFeedback();

  return (
    <Button
      size="sm"
      variant="outline"
      loading={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await verifyHotelSubscriptionPix(tenantId);
          if (!result.ok) {
            error(result.error);
            return;
          }
          if (result.paid) {
            success("PIX confirmado. +30 dias adicionados.");
            return;
          }
          success("Ainda não consta como pago no Mercado Pago.");
        })
      }
    >
      Verificar PIX
    </Button>
  );
}
