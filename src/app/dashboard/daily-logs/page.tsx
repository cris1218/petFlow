import { getDailyLogsPageData } from "@/actions/daily-logs";
import { DailyLogCard } from "@/components/dashboard/daily-log-card";

export default async function DailyLogsPage() {
  const { stays, queue } = await getDailyLogsPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Diário de bordo</h1>
        <p className="text-sm text-muted-foreground">
          Agende fotos no dia. Elas saem no horário, ou toque em enviar agora.
        </p>
      </div>
      <DailyLogCard stays={stays} queue={queue} />
    </div>
  );
}
