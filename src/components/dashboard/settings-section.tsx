"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  extra,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  extra?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold">{title}</span>
          {extra}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t px-4 py-4 sm:px-5">
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
