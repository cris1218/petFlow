import { getPendingBookings, getTodayOccupation } from "@/actions/bookings";
import { OccupationGrid } from "@/components/dashboard/occupation-grid";
import { PendingBookings } from "@/components/dashboard/pending-bookings";

export default async function DashboardPage() {
  const [occupation, pending] = await Promise.all([
    getTodayOccupation(),
    getPendingBookings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Ocupação do dia, check-ins e check-outs.
        </p>
      </div>
      <PendingBookings bookings={pending} />
      <OccupationGrid
        checkIns={occupation.checkIns}
        checkOuts={occupation.checkOuts}
        inHouse={occupation.inHouse}
      />
    </div>
  );
}
