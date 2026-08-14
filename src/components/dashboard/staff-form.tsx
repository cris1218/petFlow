"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHotelStaff } from "@/actions/team";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function CreateStaffForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success } = useFeedback();

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          setCreated(null);
          const result = await createHotelStaff({ name, email, password });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setCreated({ email: result.user.email, password: result.password });
          setName("");
          setEmail("");
          setPassword("");
          success("Usuário criado com sucesso.");
          router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="staff-name">Nome</Label>
        <Input
          id="staff-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="staff-email">E-mail de login</Label>
        <Input
          id="staff-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="staff-password">Senha inicial</Label>
        <PasswordInput
          id="staff-password"
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />
      </div>
      {error && (
        <p className="sm:col-span-2 text-sm text-destructive">{error}</p>
      )}
      {created && (
        <div className="sm:col-span-2 rounded-md border bg-muted p-3 text-sm">
          <p>Passe estes dados para a pessoa. A senha não aparece de novo.</p>
          <p className="mt-1">
            Login: <span className="font-mono">{created.email}</span>
          </p>
          <p>
            Senha: <span className="font-mono">{created.password}</span>
          </p>
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" className="w-full sm:w-auto" loading={isPending}>
          {isPending ? "Criando..." : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}
