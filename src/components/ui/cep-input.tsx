"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cepDigits, formatCepMask } from "@/lib/utils";

export function CepInput({
  value,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      autoComplete="postal-code"
      placeholder="00000-000"
      maxLength={9}
      value={formatCepMask(value)}
      onChange={(event) => onChange(cepDigits(event.target.value))}
    />
  );
}
