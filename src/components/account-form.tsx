"use client";

import { useState, useTransition } from "react";
import { updateAccountAction } from "@/actions/auth";
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

export function AccountForm({ email }: { email: string }) {
  const [nextEmail, setNextEmail] = useState(email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success } = useFeedback();

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-mail e senha</CardTitle>
        <CardDescription>
          Altere o e-mail quando quiser. A nova senha fica ao lado, opcional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await updateAccountAction({
                email: nextEmail,
                newPassword: newPassword || undefined,
                confirmPassword: confirmPassword || undefined,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setNewPassword("");
              setConfirmPassword("");
              success();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="account-email">E-mail</Label>
            <Input
              id="account-email"
              type="email"
              value={nextEmail}
              onChange={(event) => setNextEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha (opcional)</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full sm:w-auto" loading={isPending}>
            {isPending ? "Salvando..." : "Salvar conta"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
