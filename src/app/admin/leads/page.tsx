import Link from "next/link";
import { listAccessRequests } from "@/actions/leads";
import { formatDate, formatWhatsAppMask } from "@/lib/utils";

export default async function AdminLeadsPage() {
  const result = await listAccessRequests();
  const leads = result.leads;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Pedidos de acesso</h1>
        <p className="text-sm text-muted-foreground">
          Hotéis que pediram para entrar. Cadastre-os em Hotéis quando for liberar.
        </p>
      </div>
      <div className="space-y-3">
        {leads.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
        )}
        {leads.map((lead) => (
          <div key={lead.id} className="rounded-xl border bg-card p-4">
            <p className="font-medium">{lead.hotelName}</p>
            <p className="text-sm text-muted-foreground">
              {lead.city} · {formatWhatsAppMask(lead.phone)} · {lead.email}
            </p>
            {lead.notes && (
              <p className="mt-2 text-sm text-muted-foreground">{lead.notes}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {formatDate(lead.createdAt)}
            </p>
            <Link
              href={`/admin/cadastrar?name=${encodeURIComponent(lead.hotelName)}&email=${encodeURIComponent(lead.email)}`}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Cadastrar este hotel
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
