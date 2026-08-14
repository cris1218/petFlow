"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupportTicket } from "@/actions/support";
import { useFeedback } from "@/components/app-feedback";
import { APP_NAME } from "@/lib/constants";
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

export function CreateTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, startNavigation } = useFeedback();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo pedido</CardTitle>
        <CardDescription>
          Abra um chamado para o master do {APP_NAME}. Gestor e equipe veem as
          respostas aqui.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await createSupportTicket({ subject, body });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              success("Pedido enviado com sucesso.");
              startNavigation();
              router.push(`/dashboard/suporte/${result.ticketId}`);
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="support-subject">Assunto</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Ex.: WhatsApp não gera QR"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-body">Mensagem</Label>
            <textarea
              id="support-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              required
              placeholder="Descreva o que aconteceu e o que você já tentou."
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full sm:w-auto" loading={isPending}>
            {isPending ? "Enviando..." : "Enviar pedido"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
