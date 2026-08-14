"use client";

import {
  CalendarDays,
  Camera,
  CreditCard,
  DoorClosed,
  DoorOpen,
  LifeBuoy,
  Settings,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Visão geral", icon: CalendarDays },
  { href: "/dashboard/daily-logs", label: "Diário de bordo", icon: Camera },
  { href: "/dashboard/check-in", label: "Entrada", icon: DoorOpen },
  { href: "/dashboard/check-out", label: "Saída", icon: DoorClosed },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
  { href: "/dashboard/plano", label: "Plano", icon: CreditCard },
  { href: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy },
  { href: "/dashboard/conta", label: "Minha conta", icon: UserRound, staffOnly: true },
];

export function DashboardSidebar({
  tenantName,
  role,
  billingLabel,
  billingExpired,
  logoUrl,
  children,
}: {
  tenantName: string;
  role: "ADMIN" | "STAFF" | "MASTER";
  billingLabel: string;
  billingExpired?: boolean;
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  const items = NAV.filter(
    (item) =>
      (!item.adminOnly || role === "ADMIN") &&
      (!item.staffOnly || role === "STAFF"),
  );

  return (
    <AppShell
      logoUrl={logoUrl}
      subtitle={`${tenantName}${role === "STAFF" ? " · Equipe" : ""}`}
      extra={
        <p
          className={cn(
            "text-[11px]",
            billingExpired ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {billingLabel}
        </p>
      }
      items={items}
    >
      {children}
    </AppShell>
  );
}
