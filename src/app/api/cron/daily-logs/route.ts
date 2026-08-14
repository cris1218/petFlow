import { NextRequest, NextResponse } from "next/server";
import { processDueDailyLogs } from "@/actions/daily-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processDueDailyLogs();
  return NextResponse.json({ ok: true, ...result });
}
