import { addDays, addMonths, differenceInCalendarDays } from "date-fns";
import { formatBRL, formatDate } from "@/lib/utils";

export const BILLING = {
  trialDays: 30,
  introMonths: 3,
  introPrice: 19.9,
  fullPrice: 59.9,
  extraUserPrice: 9.9,
  includedUsers: 1,
  grantDays: 30,
} as const;

export type BillingPhase = "TRIAL" | "INTRO" | "FULL";

export type BillingState = {
  phase: BillingPhase;
  planPrice: number;
  extraUsers: number;
  extraTotal: number;
  monthlyTotal: number;
  pixAmount: number;
  trialEndsAt: Date;
  introEndsAt: Date;
  expiresAt: Date;
  daysLeft: number;
  isExpired: boolean;
  phaseLabel: string;
  expiresLabel: string;
  menuLabel: string;
  priceLabel: string;
};

export function getBillingState(
  createdAt: Date | string,
  userCount: number,
  billingPaidUntil?: Date | string | null,
  now = new Date(),
): BillingState {
  const start = new Date(createdAt);
  const trialEndsAt = addDays(start, BILLING.trialDays);
  const introEndsAt = addMonths(trialEndsAt, BILLING.introMonths);
  const extraUsers = Math.max(0, userCount - BILLING.includedUsers);
  const extraTotal = extraUsers * BILLING.extraUserPrice;
  const paidUntil = billingPaidUntil ? new Date(billingPaidUntil) : null;

  let phase: BillingPhase;
  let planPrice: number;

  if (now < trialEndsAt) {
    phase = "TRIAL";
    planPrice = 0;
  } else if (now < introEndsAt) {
    phase = "INTRO";
    planPrice = BILLING.introPrice;
  } else {
    phase = "FULL";
    planPrice = BILLING.fullPrice;
  }

  const expiresAt = new Date(
    Math.max(trialEndsAt.getTime(), paidUntil?.getTime() ?? 0),
  );
  const isExpired = now.getTime() >= expiresAt.getTime();
  const daysLeft = isExpired
    ? 0
    : Math.max(0, differenceInCalendarDays(expiresAt, now));
  const monthlyTotal = planPrice + extraTotal;
  const pixAmount =
    (phase === "FULL" ? BILLING.fullPrice : BILLING.introPrice) + extraTotal;

  const phaseLabel =
    phase === "TRIAL"
      ? "Gratuito"
      : phase === "INTRO"
        ? "Plano inicial"
        : "Plano mensal";

  const priceLabel =
    phase === "TRIAL" ? "R$ 0,00" : `${formatBRL(monthlyTotal)} / mês`;

  const extraBit =
    extraUsers > 0
      ? ` · +${extraUsers} usuário(s) ${formatBRL(extraTotal)}`
      : "";

  const expiresLabel = isExpired
    ? `Expirado em ${formatDate(expiresAt)}${extraBit}`
    : daysLeft === 0
      ? `Expira hoje (${formatDate(expiresAt)})${extraBit}`
      : `Expira em ${daysLeft} dia${daysLeft === 1 ? "" : "s"} · ${formatDate(expiresAt)}${extraBit}`;

  const menuLabel = isExpired
    ? "Expirado · pague o PIX"
    : `Expira ${formatDate(expiresAt)}`;

  return {
    phase,
    planPrice,
    extraUsers,
    extraTotal,
    monthlyTotal,
    pixAmount,
    trialEndsAt,
    introEndsAt,
    expiresAt,
    daysLeft,
    isExpired,
    phaseLabel,
    expiresLabel,
    menuLabel,
    priceLabel,
  };
}

export function nextPaidUntil(
  createdAt: Date | string,
  billingPaidUntil: Date | string | null | undefined,
  now = new Date(),
  days = BILLING.grantDays,
) {
  const trialEndsAt = addDays(new Date(createdAt), BILLING.trialDays);
  const paidUntil = billingPaidUntil ? new Date(billingPaidUntil) : null;
  const base = Math.max(
    now.getTime(),
    trialEndsAt.getTime(),
    paidUntil?.getTime() ?? 0,
  );
  return addDays(new Date(base), days);
}
