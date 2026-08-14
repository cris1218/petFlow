import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { APP_NAME } from "@/lib/constants";
import { isMercadoPagoConfigured } from "@/lib/mercadopago";
import { ensureTenantServices, serializeTenantService } from "@/lib/services";
import { ensureCheckInCatalog, serializeCatalogItem } from "@/lib/check-in-catalog";
import { prisma } from "@/lib/prisma";

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

  await ensureTenantServices(tenant);
  await ensureCheckInCatalog(tenant.id);
  const [services, requiredVaccines] = await Promise.all([
    prisma.tenantService.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.tenantRequiredVaccine.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const pixEnabled = isMercadoPagoConfigured(tenant);
  const serviceNames = services.map((service) => service.name);
  const offerText =
    serviceNames.length === 0
      ? "Reserve um horário"
      : serviceNames.length === 1
        ? `Reserve ${serviceNames[0]}`
        : `Reserve ${serviceNames.slice(0, -1).join(", ")} ou ${serviceNames.at(-1)}`;

  return (
    <div className="min-h-dvh bg-muted/40 px-4 py-6 sm:py-10">
      <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-8">
        {tenant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt={tenant.name}
            className="mx-auto mb-4 h-16 w-auto max-w-[200px] object-contain sm:h-24 sm:max-w-[240px]"
          />
        ) : null}
        <p className="text-sm font-medium text-primary">{APP_NAME}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{tenant.name}</h1>
        <p className="text-muted-foreground">
          {offerText}
          {pixEnabled ? " e pague o sinal via PIX." : "."} A confirmação chega no
          WhatsApp.
        </p>
      </div>
      <BookingWizard
        tenantName={tenant.name}
        tenantSlug={tenant.slug}
        tenantLogoUrl={tenant.logoUrl}
        services={services.map(serializeTenantService)}
        depositRate={Number(tenant.depositRate)}
        requiredVaccines={requiredVaccines.map(serializeCatalogItem)}
        pixEnabled={pixEnabled}
      />
    </div>
  );
}
