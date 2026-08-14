"use client";

import { useState, useTransition } from "react";
import { resetHotelUserPassword } from "@/actions/admin";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL = {
  ADMIN: "Gestor",
  STAFF: "Equipe",
  MASTER: "Master",
} as const;

type HotelUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "MASTER";
};

export function HotelUsersList({
  tenantId,
  users,
}: {
  tenantId: string;
  users: HotelUser[];
}) {
  return (
    <div className="space-y-4">
      {users.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum usuário neste hotel.</p>
      )}
      {users.map((user) => (
        <HotelUserRow key={user.id} tenantId={tenantId} user={user} />
      ))}
    </div>
  );
}

function HotelUserRow({
  tenantId,
  user,
}: {
  tenantId: string;
  user: HotelUser;
}) {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success } = useFeedback();

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">Login: {user.email}</p>
        </div>
        <Badge variant="secondary">{ROLE_LABEL[user.role] ?? user.role}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        A senha atual não pode ser vista (fica criptografada). Defina uma nova e
        anote para passar ao hotel.
      </p>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={`password-${user.id}`}>Nova senha</Label>
          <PasswordInput
            id={`password-${user.id}`}
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
          />
        </div>
        <Button
          className="w-full sm:w-auto"
          loading={isPending}
          disabled={password.length < 6}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await resetHotelUserPassword({
                tenantId,
                userId: user.id,
                newPassword: password,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setRevealed(result.password);
              setPassword("");
              success();
            })
          }
        >
          {isPending ? "Salvando..." : "Trocar senha"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {revealed && (
        <div className="rounded-md border bg-muted p-3 text-sm">
          <p>
            Usuário: <span className="font-mono">{user.email}</span>
          </p>
          <p>
            Senha nova: <span className="font-mono">{revealed}</span>
          </p>
        </div>
      )}
    </div>
  );
}
