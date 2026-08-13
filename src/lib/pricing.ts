import { differenceInCalendarDays } from "date-fns";
import { DEPOSIT_RATE, SERVICE_DAILY_RATE } from "@/lib/constants";
import { ServiceType } from "@prisma/client";

export function calculateStayPricing(
  serviceType: ServiceType,
  startDate: Date,
  endDate: Date,
) {
  const nights = Math.max(1, differenceInCalendarDays(endDate, startDate));
  const totalAmount = Number(
    (SERVICE_DAILY_RATE[serviceType] * nights).toFixed(2),
  );
  const depositAmount = Number((totalAmount * DEPOSIT_RATE).toFixed(2));

  return { nights, totalAmount, depositAmount };
}

export function serializeMoney(value: { toString(): string } | number) {
  return Number(value);
}
