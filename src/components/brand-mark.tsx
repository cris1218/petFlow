import { PawPrint } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const FRAMES = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-24 w-56 sm:h-28 sm:w-64",
} as const;

export function BrandMark({
  logoUrl,
  name,
  size = "md",
  className,
}: {
  logoUrl?: string | null;
  name?: string;
  size?: keyof typeof FRAMES;
  className?: string;
}) {
  const label = name || APP_NAME;
  const frame = FRAMES[size];

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={label}
        className={cn(
          frame,
          "shrink-0 object-contain",
          size === "lg" ? "mx-auto" : "rounded-md",
          className,
        )}
      />
    );
  }

  if (size === "lg") {
    return (
      <div
        className={cn(frame, "mx-auto flex items-center justify-center", className)}
        aria-label={APP_NAME}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:h-20 sm:w-20">
          <PawPrint className="h-8 w-8 sm:h-10 sm:w-10" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        frame,
        "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
      aria-label={APP_NAME}
    >
      <PawPrint className={size === "md" ? "h-5 w-5" : "h-4 w-4"} />
    </div>
  );
}
