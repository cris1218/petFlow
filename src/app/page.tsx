import Link from "next/link";
import { CalendarDays, Camera, MessageCircle, PawPrint, ShieldCheck } from "lucide-react";
import { APP_NAME, APP_SLOGAN } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { HotelSignupForm } from "@/components/hotel-signup-form";
import { BILLING } from "@/lib/billing";
import { formatBRL } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_#fff4ea,_#f7f3ee_45%,_#eef6f2)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="h-5 w-5" />
          </span>
          <span className="truncate">{APP_NAME}</span>
        </div>
        <Button asChild size="sm" className="shrink-0 sm:h-11 sm:px-4">
          <Link href="/login">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-primary sm:text-sm">
          Sistema para hotéis e creches pet
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          {APP_SLOGAN}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Agenda, pertences e diário de bordo — com confirmação no WhatsApp e
          entrada via PIX da conta do próprio hotel.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href="#cadastrar">Começar grátis</a>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/portais">Ver portais</Link>
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Feature
            icon={CalendarDays}
            title="Agenda e ocupação"
            text="Grade do dia com entradas, saídas e pets hospedados."
          />
          <Feature
            icon={Camera}
            title="Diário de bordo"
            text="Foto e status rápido disparados no WhatsApp do tutor."
          />
          <Feature
            icon={ShieldCheck}
            title="Pertences"
            text="Checklist na entrada e na saída, com o que o hotel exigir."
          />
          <Feature
            icon={MessageCircle}
            title="PIX + WhatsApp"
            text="O hotel conecta o próprio Mercado Pago. Confirmação automática no WhatsApp."
          />
        </div>

        <section className="mt-20 max-w-2xl">
          <h2 className="text-xl font-semibold sm:text-2xl">Cadastre seu hotel</h2>
          <p className="mt-1 mb-5 text-xs text-muted-foreground">
            {BILLING.trialDays} dias grátis · depois {formatBRL(BILLING.introPrice)}{" "}
            por {BILLING.introMonths} meses · em seguida {formatBRL(BILLING.fullPrice)}
            /mês · 1 gestor incluso · extra {formatBRL(BILLING.extraUserPrice)}
          </p>
          <HotelSignupForm />
        </section>
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof CalendarDays;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
