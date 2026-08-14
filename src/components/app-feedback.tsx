"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, CircleAlert, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; message: string };

type FeedbackContextValue = {
  success: (message?: string) => void;
  error: (message: string) => void;
  startNavigation: () => void;
  stopNavigation: () => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback precisa do AppFeedback.");
  }
  return ctx;
}

export function AppFeedback({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [navigating, setNavigating] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const idRef = useRef(0);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setToasts((current) => [...current.slice(-3), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const success = useCallback(
    (message = "Salvo com sucesso.") => push("success", message),
    [push],
  );
  const error = useCallback((message: string) => push("error", message), [push]);
  const startNavigation = useCallback(() => setNavigating(true), []);
  const stopNavigation = useCallback(() => setNavigating(false), []);

  useEffect(() => {
    if (!navigating) {
      setShowOverlay(false);
      return;
    }
    const show = window.setTimeout(() => setShowOverlay(true), 140);
    const stop = window.setTimeout(() => setNavigating(false), 8000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(stop);
    };
  }, [navigating]);

  const value = useMemo(
    () => ({ success, error, startNavigation, stopNavigation }),
    [success, error, startNavigation, stopNavigation],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <NavigationListener
          startNavigation={startNavigation}
          stopNavigation={stopNavigation}
        />
      </Suspense>
      {navigating && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden bg-primary/20">
          <div className="nav-progress-bar h-full w-1/3 rounded-full bg-primary" />
        </div>
      )}
      {showOverlay && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-background/55 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium">Carregando...</p>
          </div>
        </div>
      )}
      <div className="fixed right-4 top-4 z-[70] flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg",
              toast.kind === "success"
                ? "border-accent/25"
                : "border-destructive/30",
            )}
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            ) : (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            )}
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() =>
                setToasts((current) =>
                  current.filter((item) => item.id !== toast.id),
                )
              }
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

function NavigationListener({
  startNavigation,
  stopNavigation,
}: {
  startNavigation: () => void;
  stopNavigation: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    stopNavigation();
  }, [key, stopNavigation]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      startNavigation();
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [startNavigation]);

  return null;
}
