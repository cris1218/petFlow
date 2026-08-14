"use client";

import { useState } from "react";
import { PawPrint } from "lucide-react";
import { loginAction } from "@/actions/auth";
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

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { startNavigation, stopNavigation } = useFeedback();

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    startNavigation();
    const result = await loginAction(formData);
    if (result && !result.ok) {
      stopNavigation();
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PawPrint className="h-5 w-5 text-primary" />
            Entrar no PetFlow
          </CardTitle>
          <CardDescription>
            Hotel: use o e-mail do gestor. Master PetFlow: use o login de
            administração.
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
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
