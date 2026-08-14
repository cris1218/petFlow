"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { useFeedback } from "@/components/app-feedback";
import { BrandMark } from "@/components/brand-mark";
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
import { APP_NAME } from "@/lib/constants";

export function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { startNavigation, stopNavigation } = useFeedback();

  function onSubmit(formData: FormData) {
    if (from) formData.set("from", from);
    setError(null);
    startNavigation();
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result && !result.ok) {
        stopNavigation();
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrandMark size="sm" />
            Entrar no {APP_NAME}
          </CardTitle>
          <CardDescription>
            Use o e-mail do hotel ou o login de administração.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                disabled={pending}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" loading={pending}>
              {pending ? "Entrando..." : "Entrar"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Hotel novo?{" "}
              <a href="/#cadastrar" className="text-primary hover:underline">
                Começar 30 dias grátis
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
