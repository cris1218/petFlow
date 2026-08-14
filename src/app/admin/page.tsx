import Link from "next/link";
import { listHotels } from "@/actions/admin";
import { HotelStatusActions } from "@/components/admin/hotel-status-actions";
import { VerifyHotelPixButton } from "@/components/admin/verify-hotel-pix-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function AdminHotelsPage() {
  const hotels = await listHotels();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Hotéis</h1>
        <p className="text-sm text-muted-foreground">
          Estabelecimentos cadastrados na plataforma.
        </p>
      </div>

      <div className="space-y-3">
        {hotels.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum hotel cadastrado. Use Cadastrar para criar o primeiro.
          </p>
        )}
        {hotels.map((hotel) => (
          <div key={hotel.id} className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-medium">{hotel.name}</p>
                <p className="text-sm text-muted-foreground">
                  /agendar/{hotel.slug} · {hotel.userCount} usuário(s) ·{" "}
                  {hotel.bookingCount} reserva(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  {hotel.admins.map((admin) => `${admin.name} · ${admin.email}`).join(" · ") ||
                    "Sem gestor"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Desde {formatDate(hotel.createdAt)}
                  {hotel.whatsappConnected ? " · WhatsApp conectado" : ""}
                </p>
                <p className="mt-2 text-sm font-medium">
                  {hotel.billing.phaseLabel} · {hotel.billing.priceLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hotel.billing.expiresLabel}
                </p>
              </div>
              <Badge
                className="shrink-0"
                variant={
                  hotel.status === "SUSPENDED"
                    ? "warning"
                    : hotel.billing.isExpired
                      ? "warning"
                      : hotel.billing.phase === "TRIAL"
                        ? "secondary"
                        : "success"
                }
              >
                {hotel.status === "SUSPENDED"
                  ? "Suspenso"
                  : hotel.billing.isExpired
                    ? "Expirado"
                    : hotel.billing.phase === "TRIAL"
                      ? "Trial"
                      : "Ativo"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/hoteis/${hotel.id}`}>Usuários e senhas</Link>
              </Button>
              <Button asChild size="sm">
                <Link
                  href={`/agendar/${hotel.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir portal
                </Link>
              </Button>
              {hotel.hasPendingPix && (
                <VerifyHotelPixButton tenantId={hotel.id} />
              )}
              <HotelStatusActions
                tenantId={hotel.id}
                hotelName={hotel.name}
                status={hotel.status}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
