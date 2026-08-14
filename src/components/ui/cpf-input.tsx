"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cpfDigits, formatCpfMask } from "@/lib/utils";

export function CpfInput({
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
      autoComplete="off"
      placeholder="000.000.000-00"
      maxLength={14}
      value={formatCpfMask(value)}
      onChange={(event) => onChange(cpfDigits(event.target.value))}
    />
  );
}
