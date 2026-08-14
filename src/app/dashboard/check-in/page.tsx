import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { CheckInForm } from "@/components/dashboard/check-in-form";
import { CheckInCatalogForm } from "@/components/dashboard/check-in-catalog-form";
import { ensureCheckInCatalog, serializeCatalogItem } from "@/lib/check-in-catalog";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const { tenantId } = await requireStaffSession();
  await ensureCheckInCatalog(tenantId);

  const [bookings, belongings, requiredVaccines] = await Promise.all([
    prisma.booking.findMany({
      where: {
        tenantId,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
      include: {
        pet: { include: { tutor: true, vaccines: true } },
        checklistItems: true,
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.tenantBelonging.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.tenantRequiredVaccine.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Check-in, pertences e vacinas</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre o que o hotel exige. Na reserva e no check-in, só marca se o
          pet tem a vacina — sem data.
        </p>
      </div>
      <CheckInCatalogForm
        belongings={belongings.map(serializeCatalogItem)}
        vaccines={requiredVaccines.map(serializeCatalogItem)}
      />
      <CheckInForm
        belongings={belongings.map(serializeCatalogItem)}
        requiredVaccines={requiredVaccines.map(serializeCatalogItem)}
        bookings={bookings.map((booking) => ({
          id: booking.id,
          petName: booking.pet.name,
          tutorName: booking.pet.tutor.name,
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: booking.status,
          petVaccines: booking.pet.vaccines.map((vaccine) => vaccine.name),
          checklist: booking.checklistItems.map((item) => ({
            id: item.id,
            itemName: item.itemName,
            quantity: item.quantity,
          })),
        }))}
      />
    </div>
  );
}
