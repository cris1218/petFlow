"use client";

import { useState, useTransition } from "react";
import { registerHotel } from "@/actions/register";
import { useFeedback } from "@/components/app-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { WhatsAppInput } from "@/components/ui/whatsapp-input";
import { Label } from "@/components/ui/label";

export function HotelSignupForm() {
  const [hotelName, setHotelName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { startNavigation, stopNavigation } = useFeedback();

  return (
    <form
      id="cadastrar"
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          startNavigation();
          const result = await registerHotel({
            hotelName,
            adminName,
            email,
            password,
            whatsapp,
          });
          if (result && !result.ok) {
            stopNavigation();
            setError(result.error);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do hotel" value={hotelName} onChange={setHotelName} />
        <Field label="Seu nome (gestor)" value={adminName} onChange={setAdminName} />
        <WhatsAppField
          label="WhatsApp"
          value={whatsapp}
          onChange={setWhatsapp}
        />
        <Field label="E-mail de login" value={email} onChange={setEmail} type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha</Label>
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full sm:w-auto" loading={isPending}>
        {isPending ? "Criando..." : "Começar grátis"}
      </Button>
    </form>
  );
}

function WhatsAppField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <WhatsAppInput value={value} onChange={onChange} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  );
}
