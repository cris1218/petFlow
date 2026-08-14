import { NextRequest, NextResponse } from "next/server";
import { processDueDailyLogs } from "@/lib/daily-log-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processDueDailyLogs(undefined, 3);
  return NextResponse.json({ ok: true, ...result });
}
