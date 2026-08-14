"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { useFeedback } from "@/components/app-feedback";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
};

export function AppShell({
  subtitle,
  extra,
  items,
  logoUrl,
  children,
}: {
  subtitle: string;
  extra?: React.ReactNode;
  items: AppNavItem[];
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { startNavigation } = useFeedback();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {items.map((item) => {
        const isRootDashboard = item.href === "/dashboard";
        const isRootAdmin = item.href === "/admin";
        const isActive = item.match
          ? item.match(pathname)
          : isRootDashboard
            ? pathname === "/dashboard"
            : isRootAdmin
              ? pathname === "/admin" || pathname.startsWith("/admin/hoteis")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const logout = (
    <form
      action={async () => {
        startNavigation();
        await logoutAction();
      }}
      className="border-t p-3"
    >
      <Button variant="ghost" className="min-h-11 w-full justify-start" type="submit">
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </form>
  );

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BrandMark logoUrl={logoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{APP_NAME}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </header>

      {open ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,86vw)] flex-col border-r bg-card pt-[env(safe-area-inset-top)] transition-transform duration-200 md:static md:z-0 md:w-64 md:translate-x-0 md:pt-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark logoUrl={logoUrl} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{APP_NAME}</p>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              {extra}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-muted md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {nav}
        {logout}
      </aside>

      <main className="min-w-0 flex-1 bg-muted/30 px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
