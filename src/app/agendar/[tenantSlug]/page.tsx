import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { APP_NAME } from "@/lib/constants";
import { ratesFromTenant } from "@/lib/pricing";
import { isMercadoPagoConfigured } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({
  params,
}: {
  params: { tenantSlug: string };
}) {
  const tenant = await getTenantBySlug(params.tenantSlug);

  if (!tenant || tenant.status === "SUSPENDED") {
    notFound();
  }

  const pixEnabled = isMercadoPagoConfigured(tenant);

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto mb-8 max-w-3xl text-center">
        <p className="text-sm font-medium text-primary">{APP_NAME}</p>
        <h1 className="mt-1 text-3xl font-semibold">{tenant.name}</h1>
        <p className="text-muted-foreground">
          Reserve hotel, creche ou banho
          {pixEnabled ? " e pague o sinal via PIX." : "."} A confirmação chega no
          WhatsApp.
        </p>
      </div>
      <BookingWizard
        tenantName={tenant.name}
        tenantSlug={tenant.slug}
        rates={ratesFromTenant(tenant)}
        pixEnabled={pixEnabled}
      />
    </div>
  );
}
