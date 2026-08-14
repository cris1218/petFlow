"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeHotelStaff, resetStaffPassword } from "@/actions/team";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

type StaffUser = {
  id: string;
  name: string;
  email: string;
};

export function StaffList({ users }: { users: StaffUser[] }) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum usuário da equipe ainda.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <StaffRow key={user.id} user={user} />
      ))}
    </div>
  );
}

function StaffRow({ user }: { user: StaffUser }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success } = useFeedback();

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">Login: {user.email}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          loading={isPending}
          onClick={() => {
            if (!confirm(`Remover ${user.name} da equipe?`)) return;
            startTransition(async () => {
              setError(null);
              const result = await removeHotelStaff(user.id);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              success("Usuário removido com sucesso.");
              router.refresh();
            });
          }}
        >
          Remover
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A senha atual não pode ser vista. Defina uma nova e anote para passar à
        pessoa.
      </p>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={`staff-password-${user.id}`}>Nova senha</Label>
          <PasswordInput
            id={`staff-password-${user.id}`}
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
              const result = await resetStaffPassword({
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
            Login: <span className="font-mono">{user.email}</span>
          </p>
          <p>
            Senha nova: <span className="font-mono">{revealed}</span>
          </p>
        </div>
      )}
    </div>
  );
}
