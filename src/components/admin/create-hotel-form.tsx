"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHotel } from "@/actions/admin";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CreateHotelForm({
  defaults,
}: {
  defaults?: {
    name?: string;
    adminName?: string;
    adminEmail?: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(defaults?.name ?? "");
  const [slug, setSlug] = useState("");
  const [adminName, setAdminName] = useState(defaults?.adminName ?? "");
  const [adminEmail, setAdminEmail] = useState(defaults?.adminEmail ?? "");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, startNavigation } = useFeedback();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadastrar hotel</CardTitle>
        <CardDescription>
          Cria o hotel e 1 gestor. A contagem dos 30 dias grátis começa agora.
          Usuários extras da equipe custam R$ 9,90 cada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await createHotel({
                name,
                slug: slug || undefined,
                adminName,
                adminEmail,
                adminPassword,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setAdminPassword("");
              success("Hotel cadastrado com sucesso.");
              startNavigation();
              router.push("/admin");
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="hotel-name">Nome do hotel</Label>
            <Input
              id="hotel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="slug">Slug do portal (opcional)</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="hotel-do-ron-ron"
            />
            <p className="text-xs text-muted-foreground">
              URL pública: /agendar/slug
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-name">Nome do gestor</Label>
            <Input
              id="admin-name"
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">E-mail do gestor</Label>
            <Input
              id="admin-email"
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="admin-password">Senha inicial do gestor</Label>
            <PasswordInput
              id="admin-password"
              autoComplete="new-password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
          {error && (
            <p className="sm:col-span-2 text-sm text-destructive">{error}</p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full sm:w-auto" loading={isPending}>
              {isPending ? "Cadastrando..." : "Cadastrar hotel"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
