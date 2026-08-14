"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMasterSupportTicket } from "@/actions/support";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type HotelOption = {
  id: string;
  name: string;
  users: Array<{ name: string; role: "ADMIN" | "STAFF" | "MASTER" }>;
};

export function CreateMasterTicketForm({ hotels }: { hotels: HotelOption[] }) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(hotels[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, startNavigation } = useFeedback();

  if (hotels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre um hotel para abrir chamado.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo chamado para o hotel</CardTitle>
        <CardDescription>
          O gestor e a equipe desse hotel recebem e respondem no painel deles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await createMasterSupportTicket({
                tenantId,
                subject,
                body,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              success("Chamado enviado com sucesso.");
              startNavigation();
              router.push(`/admin/suporte/${result.ticketId}`);
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="support-hotel">Hotel</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger id="support-hotel">
                <SelectValue placeholder="Escolha o hotel" />
              </SelectTrigger>
              <SelectContent>
                {hotels.map((hotel) => {
                  const people = hotel.users
                    .map((user) =>
                      user.role === "ADMIN"
                        ? `${user.name} (gestor)`
                        : `${user.name} (equipe)`,
                    )
                    .join(", ");
                  return (
                    <SelectItem key={hotel.id} value={hotel.id}>
                      {hotel.name}
                      {people ? ` · ${people}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-subject">Assunto</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Ex.: Atualizar dados do PIX"
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
              placeholder="Escreva o recado para o hotel."
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full sm:w-auto" loading={isPending}>
            {isPending ? "Enviando..." : "Abrir chamado"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
