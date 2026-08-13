import { differenceInCalendarDays } from "date-fns";
import { DEPOSIT_RATE, SERVICE_DAILY_RATE } from "@/lib/constants";
import { ServiceType } from "@prisma/client";

export type TenantRates = {
  hotelRate: number;
  daycareRate: number;
  groomingRate: number;
  depositRate: number;
};

export const DEFAULT_RATES: TenantRates = {
  hotelRate: SERVICE_DAILY_RATE.HOTEL,
  daycareRate: SERVICE_DAILY_RATE.DAYCARE,
  groomingRate: SERVICE_DAILY_RATE.GROOMING,
  depositRate: DEPOSIT_RATE,
};

export function ratesFromTenant(tenant: {
  hotelRate: { toString(): string } | number;
  daycareRate: { toString(): string } | number;
  groomingRate: { toString(): string } | number;
  depositRate: { toString(): string } | number;
}): TenantRates {
  return {
    hotelRate: Number(tenant.hotelRate),
    daycareRate: Number(tenant.daycareRate),
    groomingRate: Number(tenant.groomingRate),
    depositRate: Number(tenant.depositRate),
  };
}

export function dailyRateFor(serviceType: ServiceType, rates: TenantRates) {
  if (serviceType === "HOTEL") return rates.hotelRate;
  if (serviceType === "DAYCARE") return rates.daycareRate;
  return rates.groomingRate;
}

export function calculateStayPricing(
  serviceType: ServiceType,
  startDate: Date,
  endDate: Date,
  rates: TenantRates = DEFAULT_RATES,
) {
  const nights = Math.max(1, differenceInCalendarDays(endDate, startDate));
  const totalAmount = Number((dailyRateFor(serviceType, rates) * nights).toFixed(2));
  const depositAmount = Number((totalAmount * rates.depositRate).toFixed(2));

  return { nights, totalAmount, depositAmount };
}

export function serializeMoney(value: { toString(): string } | number) {
  return Number(value);
}
