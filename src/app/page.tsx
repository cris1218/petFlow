import Link from "next/link";
import { CalendarDays, Camera, MessageCircle, PawPrint, ShieldCheck } from "lucide-react";
import { APP_NAME, APP_SLOGAN } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff4ea,_#f7f3ee_45%,_#eef6f2)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="h-5 w-5" />
          </span>
          {APP_NAME}
        </div>
        <Button asChild>
          <Link href="/login">Entrar no painel</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
          SaaS para hotéis e creches pet
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {APP_SLOGAN}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          PetFlow organiza ocupação, vacinas, pertences e o diário de bordo do
          pet — e avisa o tutor no WhatsApp, no plano gratuito da Vercel, Neon e Cloudinary.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/agendar/hotel-do-ron-ron">Ver portal de agendamento</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Acessar dashboard</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={CalendarDays}
            title="Agenda e ocupação"
            text="Grade do dia com check-ins, check-outs e pets hospedados."
          />
          <Feature
            icon={Camera}
            title="Diário de bordo"
            text="Foto no Cloudinary e status rápido disparado no WhatsApp."
          />
          <Feature
            icon={ShieldCheck}
            title="Vacinas e pertences"
            text="Alerta de vacina vencida e checklist de ração, medicação e coleira."
          />
          <Feature
            icon={MessageCircle}
            title="PIX + WhatsApp"
            text="Sinal via Mercado Pago e confirmação automática na Evolution API."
          />
        </div>
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
