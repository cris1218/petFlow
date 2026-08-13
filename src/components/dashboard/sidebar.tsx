"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Camera,
  LogOut,
  MessageCircle,
  PawPrint,
  ClipboardCheck,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Visão geral", icon: CalendarDays },
  { href: "/dashboard/daily-logs", label: "Diário de bordo", icon: Camera },
  { href: "/dashboard/check-in", label: "Check-in e vacinas", icon: ClipboardCheck },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageCircle },
];

export function DashboardSidebar({
  tenantName,
}: {
  tenantName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <PawPrint className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">{APP_NAME}</p>
          <p className="text-xs text-muted-foreground">{tenantName}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action={logoutAction} className="border-t p-3">
        <Button variant="ghost" className="w-full justify-start" type="submit">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </form>
    </aside>
  );
}
