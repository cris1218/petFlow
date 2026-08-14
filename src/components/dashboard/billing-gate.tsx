"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const ALLOWED_WHEN_EXPIRED = [
  "/dashboard/plano",
  "/dashboard/conta",
  "/dashboard/suporte",
];

export function BillingGate({
  expired,
  children,
}: {
  expired: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = ALLOWED_WHEN_EXPIRED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  useEffect(() => {
    if (expired && !allowed) {
      router.replace("/dashboard/plano");
    }
  }, [expired, allowed, router]);

  if (expired && !allowed) {
    return (
      <p className="text-sm text-muted-foreground">
        O período de uso acabou. Redirecionando para o PIX do plano...
      </p>
    );
  }

  return children;
}
