import { getCheckedInStays } from "@/actions/daily-logs";
import { DailyLogCard } from "@/components/dashboard/daily-log-card";

export default async function DailyLogsPage() {
  const stays = await getCheckedInStays();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Diário de bordo</h1>
        <p className="text-sm text-muted-foreground">
          Envie fotos e status rápidos para o WhatsApp do tutor.
        </p>
      </div>
      <DailyLogCard stays={stays} />
    </div>
  );
}
