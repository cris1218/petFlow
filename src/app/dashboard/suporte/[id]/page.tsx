import Link from "next/link";
import { notFound } from "next/navigation";
import { getHotelSupportTicket } from "@/actions/support";
import { TicketReplyForm } from "@/components/support/ticket-reply-form";
import { TicketStatusBadge } from "@/components/support/ticket-status-badge";
import { TicketThread } from "@/components/support/ticket-thread";
import { formatDateTime } from "@/lib/utils";

export default async function HotelSupportTicketPage({
  params,
}: {
  params: { id: string };
}) {
  const result = await getHotelSupportTicket(params.id);
  if (!result.ok) {
    notFound();
  }

  const { ticket } = result;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/suporte"
          className="text-sm text-primary hover:underline"
        >
          ← Voltar aos pedidos
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">{ticket.subject}</h1>
            <p className="text-sm text-muted-foreground">
              Aberto{" "}
              {ticket.author.role === "MASTER"
                ? "pelo master PetFlow"
                : `por ${ticket.author.name}`}{" "}
              em {formatDateTime(ticket.createdAt)}
            </p>
          </div>
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      <TicketThread messages={ticket.messages} />

      <div className="rounded-xl border bg-card p-4">
        <TicketReplyForm
          ticketId={ticket.id}
          closed={ticket.status === "CLOSED"}
          asMaster={false}
        />
      </div>
    </div>
  );
}
