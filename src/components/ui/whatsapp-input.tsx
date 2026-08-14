"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatWhatsAppMask, phoneDigits } from "@/lib/utils";

export function WhatsAppInput({
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
      autoComplete="tel"
      placeholder="(11) 99999-9999"
      maxLength={15}
      value={formatWhatsAppMask(value)}
      onChange={(event) => onChange(phoneDigits(event.target.value))}
    />
  );
}
