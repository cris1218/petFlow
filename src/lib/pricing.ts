import { differenceInCalendarDays } from "date-fns";
import { DEPOSIT_RATE } from "@/lib/constants";

export type BookableService = {
  id: string;
  name: string;
  price: number;
  kind: "STAY" | "APPOINTMENT";
};

export function calculateStayPricing(
  dailyRate: number,
  startDate: Date,
  endDate: Date,
  depositRate = DEPOSIT_RATE,
) {
  const nights = Math.max(1, differenceInCalendarDays(endDate, startDate));
  const totalAmount = Number((dailyRate * nights).toFixed(2));
  const depositAmount = Number((totalAmount * depositRate).toFixed(2));

  return { nights, totalAmount, depositAmount };
}

export function serializeMoney(value: { toString(): string } | number) {
  return Number(value);
}
