import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { BrandMark } from "@/components/brand-mark";
import { petPolicyFromTenant } from "@/lib/constants";
import { isMercadoPagoConfigured } from "@/lib/mercadopago";
import { ensureTenantServices, serializeTenantService } from "@/lib/services";
import { ensureTenantSchedule } from "@/lib/tenant-schedule";
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
  await ensureTenantSchedule(tenant.id);
  const [services, requiredVaccines] = await Promise.all([
    prisma.tenantService.findMany({
      where: { tenantId: tenant.id, active: true },
      include: { weekdays: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.tenantRequiredVaccine.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
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
        <BrandMark
          logoUrl={tenant.logoUrl}
          name={tenant.name}
          size="lg"
          className="mb-4"
        />
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{tenant.name}</h1>
        <p className="text-muted-foreground">
          {offerText}
          {pixEnabled ? " Se houver entrada, pague via PIX." : "."} A confirmação chega no
          WhatsApp.
        </p>
      </div>
      <BookingWizard
        tenantName={tenant.name}
        tenantSlug={tenant.slug}
        tenantLogoUrl={tenant.logoUrl}
        services={services.map(serializeTenantService)}
        requiredVaccines={requiredVaccines}
        pixEnabled={pixEnabled}
        petPolicy={petPolicyFromTenant(tenant)}
      />
    </div>
  );
}
