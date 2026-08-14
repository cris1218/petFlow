"use client";

import {
  CalendarDays,
  Camera,
  CreditCard,
  LifeBuoy,
  MessageCircle,
  ClipboardCheck,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Visão geral", icon: CalendarDays },
  { href: "/dashboard/daily-logs", label: "Diário de bordo", icon: Camera },
  { href: "/dashboard/check-in", label: "Check-in e vacinas", icon: ClipboardCheck },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageCircle, adminOnly: true },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
  { href: "/dashboard/equipe", label: "Equipe", icon: Users, adminOnly: true },
  { href: "/dashboard/plano", label: "Plano", icon: CreditCard },
  { href: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy },
  { href: "/dashboard/conta", label: "Minha conta", icon: UserRound },
];

export function DashboardSidebar({
  tenantName,
  role,
  billingLabel,
  billingExpired,
  children,
}: {
  tenantName: string;
  role: "ADMIN" | "STAFF" | "MASTER";
  billingLabel: string;
  billingExpired?: boolean;
  children: React.ReactNode;
}) {
  const items = NAV.filter((item) => !item.adminOnly || role === "ADMIN");

  return (
    <AppShell
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
