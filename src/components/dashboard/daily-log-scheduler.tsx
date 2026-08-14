"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { flushDueDailyLogs } from "@/actions/daily-logs";

export function DailyLogScheduler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const result = await flushDueDailyLogs();
        if (!cancelled && result.sent > 0 && pathname.includes("/daily-logs")) {
          router.refresh();
        }
      } catch (error) {
        console.error("[daily-log] scheduler", error);
      }
    }

    void tick();
    const timer = window.setInterval(tick, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, router]);

  return null;
}
