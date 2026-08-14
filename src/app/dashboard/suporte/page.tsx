import Link from "next/link";
import { listHotelSupportTickets } from "@/actions/support";
import { CreateTicketForm } from "@/components/support/create-ticket-form";
import { TicketStatusBadge } from "@/components/support/ticket-status-badge";
import { formatDateTime } from "@/lib/utils";

export default async function HotelSupportPage() {
  const tickets = await listHotelSupportTickets();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Suporte</h1>
        <p className="text-sm text-muted-foreground">
          Abra um chamado para o master do PetFlow. Chamados que o master enviar
          ao hotel também aparecem aqui.
        </p>
      </div>

      <CreateTicketForm />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Chamados do hotel</h2>
        {tickets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum chamado ainda.
          </p>
        )}
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/dashboard/suporte/${ticket.id}`}
            className="block rounded-xl border bg-card p-4 hover:bg-muted/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{ticket.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.openedByMaster
                    ? "Enviado pelo master"
                    : `Aberto por ${ticket.authorName}`}
                </p>
              </div>
              <TicketStatusBadge status={ticket.status} />
            </div>
            {ticket.lastMessage && (
              <p className="mt-1 text-sm text-muted-foreground">
                {ticket.lastMessage}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Atualizado em {formatDateTime(ticket.updatedAt)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
