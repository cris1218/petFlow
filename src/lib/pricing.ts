import { differenceInCalendarDays } from "date-fns";
import { DEFAULT_DAILY_CUTOFF, TIME_PATTERN, type ServiceKind } from "@/lib/schedule";

export type BookableService = {
  id: string;
  name: string;
  price: number;
  kind: ServiceKind;
  dailyCutoffTime?: string | null;
  depositAmount?: number | null;
};

export function countStayNights(
  startDate: Date,
  endDate: Date,
  checkoutTime?: string | null,
  cutoffTime = DEFAULT_DAILY_CUTOFF,
) {
  const nights = Math.max(1, differenceInCalendarDays(endDate, startDate));
  if (
    checkoutTime &&
    TIME_PATTERN.test(checkoutTime) &&
    TIME_PATTERN.test(cutoffTime) &&
    checkoutTime > cutoffTime
  ) {
    return nights + 1;
  }
  return nights;
}

export function calculateStayPricing(
  dailyRate: number,
  startDate: Date,
  endDate: Date,
  options?: {
    checkoutTime?: string | null;
    cutoffTime?: string | null;
    depositAmount?: number | null;
    days?: number;
  },
) {
  const nights =
    options?.days ??
    countStayNights(
      startDate,
      endDate,
      options?.checkoutTime,
      options?.cutoffTime ?? DEFAULT_DAILY_CUTOFF,
    );
  const totalAmount = Number((dailyRate * nights).toFixed(2));
  const fixedDeposit = Number(options?.depositAmount ?? 0);
  const depositAmount =
    fixedDeposit > 0
      ? Number(Math.min(fixedDeposit, totalAmount).toFixed(2))
      : 0;

  return { nights, totalAmount, depositAmount };
}

export function serializeMoney(value: { toString(): string } | number) {
  return Number(value);
}
