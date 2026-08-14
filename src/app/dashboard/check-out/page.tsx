import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { CheckInForm } from "@/components/dashboard/check-in-form";

export const dynamic = "force-dynamic";

export default async function CheckOutPage() {
  const { tenantId } = await requireStaffSession();

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      status: "CHECKED_IN",
    },
    include: {
      pet: { include: { tutor: true } },
      checklistItems: true,
    },
    orderBy: { startDate: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Saída</h1>
        <p className="text-sm text-muted-foreground">
          Marque os pertences devolvidos para liberar a saída.
        </p>
      </div>
      <CheckInForm
        mode="check-out"
        bookings={bookings.map((booking) => ({
          id: booking.id,
          petName: booking.pet.name,
          tutorName: booking.pet.tutor.name,
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: booking.status,
          species: booking.pet.species,
          castrated: booking.pet.castrated,
          vaccinated: booking.pet.vaccinated,
          aggressive: booking.pet.aggressive,
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
