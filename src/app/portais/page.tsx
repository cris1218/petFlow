import Link from "next/link";
import { PawPrint } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { listPublicPortals } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portais",
};

export default async function PortaisPage() {
  const portals = await listPublicPortals();

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_#fff4ea,_#f7f3ee_45%,_#eef6f2)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="h-5 w-5" />
          </span>
          <span className="truncate">{APP_NAME}</span>
        </Link>
        <Button asChild size="sm" className="shrink-0 sm:h-11 sm:px-4">
          <Link href="/login">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Portais</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Escolha um estabelecimento para ver a agenda e fazer uma reserva.
        </p>

        {portals.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            Nenhum portal cadastrado ainda.
          </p>
        ) : (
          <div
            className={`mt-10 grid gap-3 ${
              portals.length === 1
                ? "grid-cols-1"
                : portals.length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {portals.map((portal) => (
              <Link
                key={portal.id}
                href={`/agendar/${portal.slug}`}
                className="flex min-h-24 items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted"
              >
                <BrandMark logoUrl={portal.logoUrl} name={portal.name} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{portal.name}</p>
                  <p className="text-sm text-muted-foreground">Abrir agenda</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
