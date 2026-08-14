"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createRequiredVaccine,
  createTenantBelonging,
  deleteRequiredVaccine,
  deleteTenantBelonging,
} from "@/actions/check-in-catalog";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CatalogItem = { id: string; name: string };

export function CheckInCatalogForm({
  belongings,
  vaccines,
}: {
  belongings: CatalogItem[];
  vaccines: CatalogItem[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <NameList
        title="Pertences do check-in"
        description="Cadastre o que o hotel costuma receber. Na hora do check-in, a equipe marca o que o tutor trouxe."
        placeholder="Ex.: Ração, Coleira, Cama"
        items={belongings}
        add={createTenantBelonging}
        remove={deleteTenantBelonging}
      />
      <NameList
        title="Vacinas necessárias"
        description="Cadastre as vacinas que o pet precisa ter. Não usa data: só se tem ou não tem."
        placeholder="Ex.: V10, Raiva, Giárdia"
        items={vaccines}
        add={createRequiredVaccine}
        remove={deleteRequiredVaccine}
      />
    </div>
  );
}

function NameList({
  title,
  description,
  placeholder,
  items,
  add,
  remove,
}: {
  title: string;
  description: string;
  placeholder: string;
  items: CatalogItem[];
  add: (name: string) => Promise<
    { ok: true; item: CatalogItem } | { ok: false; error: string }
  >;
  remove: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [list, setList] = useState(items);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useFeedback();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum item cadastrado.</p>
        )}
        <ul className="space-y-2">
          {list.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{item.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                loading={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await remove(item.id);
                    if (!result.ok) {
                      setError(result.error);
                      toastError(result.error);
                      return;
                    }
                    setList((current) =>
                      current.filter((row) => row.id !== item.id),
                    );
                    success("Removido.");
                  })
                }
                aria-label={`Excluir ${item.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={placeholder}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                startTransition(async () => {
                  setError(null);
                  const result = await add(name);
                  if (!result.ok) {
                    setError(result.error);
                    toastError(result.error);
                    return;
                  }
                  setList((current) => [...current, result.item]);
                  setName("");
                  success("Cadastrado.");
                });
              }
            }}
          />
          <Button
            type="button"
            className="w-full shrink-0 sm:w-auto"
            loading={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await add(name);
                if (!result.ok) {
                  setError(result.error);
                  toastError(result.error);
                  return;
                }
                setList((current) => [...current, result.item]);
                setName("");
                success("Cadastrado.");
              })
            }
          >
            <Plus className="h-4 w-4" />
            Cadastrar
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
