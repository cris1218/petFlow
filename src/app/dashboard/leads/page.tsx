import { notFound } from "next/navigation";
import { listAccessRequests } from "@/actions/leads";
import { formatDate } from "@/lib/utils";

export default async function LeadsPage() {
  const result = await listAccessRequests();
  if (!result.ok) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pedidos de acesso</h1>
        <p className="text-sm text-muted-foreground">
          Hotéis que pediram para entrar no PetFlow.
        </p>
      </div>
      <div className="space-y-3">
        {result.leads.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
        )}
        {result.leads.map((lead) => (
          <div key={lead.id} className="rounded-xl border bg-card p-4">
            <p className="font-medium">{lead.hotelName}</p>
            <p className="text-sm text-muted-foreground">
              {lead.city} · {lead.phone} · {lead.email}
            </p>
            {lead.notes && (
              <p className="mt-2 text-sm text-muted-foreground">{lead.notes}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {formatDate(lead.createdAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
