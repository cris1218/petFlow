"use client";

import { Building2, Inbox, LifeBuoy, PlusCircle, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const NAV = [
  { href: "/admin", label: "Hotéis", icon: Building2 },
  { href: "/admin/cadastrar", label: "Cadastrar", icon: PlusCircle },
  { href: "/admin/leads", label: "Pedidos de acesso", icon: Inbox },
  { href: "/admin/suporte", label: "Suporte", icon: LifeBuoy },
  { href: "/admin/conta", label: "Minha conta", icon: UserRound },
];

export function AdminSidebar({
  masterName,
  children,
}: {
  masterName: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell subtitle={`Master · ${masterName}`} items={NAV}>
      {children}
    </AppShell>
  );
}
