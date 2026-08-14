"use client";

import { useState, useTransition } from "react";
import { submitAccessRequest } from "@/actions/leads";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppInput } from "@/components/ui/whatsapp-input";
import { Label } from "@/components/ui/label";

export function AccessRequestForm() {
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { success } = useFeedback();

  if (done) {
    return (
      <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Recebemos seu pedido. Entramos em contato no WhatsApp para liberar o
        hotel no PetFlow.
      </p>
    );
  }

  return (
    <form
      id="pedir-acesso"
      className="space-y-4 rounded-xl border bg-card p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await submitAccessRequest({
            hotelName,
            city,
            phone,
            email,
            notes,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setDone(true);
          success("Pedido enviado com sucesso.");
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do hotel" value={hotelName} onChange={setHotelName} />
        <Field label="Cidade" value={city} onChange={setCity} />
        <div className="space-y-2">
          <Label>WhatsApp</Label>
          <WhatsAppInput value={phone} onChange={setPhone} required />
        </div>
        <Field label="E-mail" value={email} onChange={setEmail} type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Como podemos ajudar?</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full sm:w-auto" loading={isPending}>
        {isPending ? "Enviando..." : "Pedir acesso"}
      </Button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}
