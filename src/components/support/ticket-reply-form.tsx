"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closeSupportTicket,
  reopenSupportTicket,
  replyHotelSupportTicket,
  replyMasterSupportTicket,
} from "@/actions/support";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/app-feedback";

export function TicketReplyForm({
  ticketId,
  closed,
  asMaster,
}: {
  ticketId: string;
  closed: boolean;
  asMaster: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success } = useFeedback();

  function refresh() {
    router.refresh();
  }

  if (closed && !asMaster) {
    return (
      <p className="text-sm text-muted-foreground">
        Este pedido foi encerrado. Abra um novo se ainda precisar de ajuda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!closed && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = asMaster
                ? await replyMasterSupportTicket({ ticketId, body })
                : await replyHotelSupportTicket({ ticketId, body });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setBody("");
              success("Mensagem enviada com sucesso.");
              refresh();
            });
          }}
        >
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            required
            placeholder={asMaster ? "Resposta para o hotel..." : "Escreva sua mensagem..."}
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full sm:w-auto" loading={isPending}>
            {isPending ? "Enviando..." : asMaster ? "Responder" : "Enviar"}
          </Button>
        </form>
      )}

      {asMaster && (
        <div className="flex flex-wrap gap-2">
          {closed ? (
            <Button
              type="button"
              variant="outline"
              loading={isPending}
              onClick={() => {
                startTransition(async () => {
                  setError(null);
                  const result = await reopenSupportTicket(ticketId);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  success("Pedido reaberto com sucesso.");
                  refresh();
                });
              }}
            >
              Reabrir pedido
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              loading={isPending}
              onClick={() => {
                startTransition(async () => {
                  setError(null);
                  const result = await closeSupportTicket(ticketId);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  success("Pedido encerrado com sucesso.");
                  refresh();
                });
              }}
            >
              Encerrar pedido
            </Button>
          )}
        </div>
      )}
      {closed && asMaster && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
