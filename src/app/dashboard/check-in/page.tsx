import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { CheckInForm } from "@/components/dashboard/check-in-form";

export default async function CheckInPage() {
  const { tenantId } = await requireStaffSession();
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    include: {
      pet: { include: { tutor: true, vaccines: true } },
      checklistItems: true,
    },
    orderBy: { startDate: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Check-in, pertences e vacinas</h1>
        <p className="text-sm text-muted-foreground">
          Alerta automático se o pet estiver com vacina vencida.
        </p>
      </div>
      <CheckInForm
        bookings={bookings.map((booking) => ({
          id: booking.id,
          petName: booking.pet.name,
          tutorName: booking.pet.tutor.name,
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: booking.status,
          expiredVaccines: booking.pet.vaccines
            .filter(
              (vaccine) =>
                vaccine.status === "EXPIRED" || vaccine.expirationDate < new Date(),
            )
            .map((vaccine) => vaccine.name),
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
