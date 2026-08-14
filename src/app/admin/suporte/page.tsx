import Link from "next/link";
import {
  listHotelsForSupport,
  listMasterSupportTickets,
} from "@/actions/support";
import { CreateMasterTicketForm } from "@/components/support/create-master-ticket-form";
import { TicketStatusBadge } from "@/components/support/ticket-status-badge";
import { cn, formatDateTime } from "@/lib/utils";

const FILTERS = [
  { id: "pending", label: "Pendentes" },
  { id: "waiting-hotel", label: "Aguardando hotel" },
  { id: "closed", label: "Encerrados" },
  { id: "all", label: "Todos" },
] as const;

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = searchParams.filter ?? "pending";
  const [{ tickets, counts }, hotels] = await Promise.all([
    listMasterSupportTickets(filter === "all" ? undefined : filter),
    listHotelsForSupport(),
  ]);

  const countByFilter: Record<string, number> = {
    pending: counts.pending,
    "waiting-hotel": counts.waitingHotel,
    closed: counts.closed,
    all: counts.all,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Suporte</h1>
        <p className="text-sm text-muted-foreground">
          Abra um chamado para qualquer hotel. Gestor e equipe respondem no
          painel deles. Chamados que eles abrirem para você também entram aqui.
        </p>
      </div>

      <CreateMasterTicketForm hotels={hotels} />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "pending" ? "/admin/suporte" : `/admin/suporte?filter=${item.id}`}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 py-1 text-sm",
              filter === item.id
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label} ({countByFilter[item.id]})
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {tickets.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum pedido neste filtro.</p>
        )}
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/admin/suporte/${ticket.id}`}
            className="block rounded-xl border bg-card p-4 hover:bg-muted/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{ticket.subject}</p>
                <p className="text-sm text-muted-foreground">
                  {ticket.hotelName}
                  {ticket.openedByMaster ? " · enviado por você" : ""}
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
