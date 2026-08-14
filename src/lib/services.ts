import { prisma } from "@/lib/prisma";
import { defaultWeekdays, effectiveServiceKind, type ServiceKind } from "@/lib/schedule";

export const DEFAULT_TENANT_SERVICES = [
  { name: "Hotel", price: 80, sortOrder: 0, kind: "STAY" as const },
  { name: "Creche", price: 50, sortOrder: 1, kind: "DAYCARE" as const },
  { name: "Banho e tosa", price: 70, sortOrder: 2, kind: "APPOINTMENT" as const },
] as const;

type ServiceRow = {
  id: string;
  name: string;
  price: { toString(): string } | number;
  kind: ServiceKind;
  active: boolean;
  sortOrder: number;
  dailyCutoffTime?: string | null;
  depositAmount?: { toString(): string } | number | null;
  catCapacity?: number;
  dogCapacity?: number;
  periodCapacity?: number;
  slotDurationMin?: number;
  slotCapacity?: number;
  weekdays?: Array<{
    weekday: number;
    openTime: string;
    closeTime: string;
    closed: boolean;
  }>;
};

export function defaultServicesCreate(
  rates?: {
    hotelRate?: { toString(): string } | number;
    daycareRate?: { toString(): string } | number;
    groomingRate?: { toString(): string } | number;
  },
) {
  return [
    {
      name: "Hotel",
      price: Number(rates?.hotelRate ?? DEFAULT_TENANT_SERVICES[0].price),
      sortOrder: 0,
      active: true,
      kind: "STAY" as const,
      dailyCutoffTime: "12:00",
      catCapacity: 10,
      dogCapacity: 10,
    },
    {
      name: "Creche",
      price: Number(rates?.daycareRate ?? DEFAULT_TENANT_SERVICES[1].price),
      sortOrder: 1,
      active: true,
      kind: "DAYCARE" as const,
      periodCapacity: 10,
      weekdays: { create: defaultWeekdays() },
    },
    {
      name: "Banho e tosa",
      price: Number(rates?.groomingRate ?? DEFAULT_TENANT_SERVICES[2].price),
      sortOrder: 2,
      active: true,
      kind: "APPOINTMENT" as const,
      slotDurationMin: 30,
      slotCapacity: 1,
      weekdays: { create: defaultWeekdays() },
    },
  ];
}

export async function ensureTenantServices(tenant: {
  id: string;
  hotelRate?: { toString(): string } | number;
  daycareRate?: { toString(): string } | number;
  groomingRate?: { toString(): string } | number;
}) {
  const count = await prisma.tenantService.count({
    where: { tenantId: tenant.id },
  });
  if (count > 0) return;

  for (const service of defaultServicesCreate(tenant)) {
    await prisma.tenantService.create({
      data: {
        ...service,
        tenantId: tenant.id,
      },
    });
  }
}

export function serializeTenantService(service: ServiceRow) {
  return {
    id: service.id,
    name: service.name,
    price: Number(service.price),
    kind: effectiveServiceKind(service.kind, service.name),
    active: service.active,
    sortOrder: service.sortOrder,
    dailyCutoffTime: service.dailyCutoffTime ?? "12:00",
    depositAmount: service.depositAmount == null ? null : Number(service.depositAmount),
    catCapacity: service.catCapacity ?? 10,
    dogCapacity: service.dogCapacity ?? 10,
    periodCapacity: service.periodCapacity ?? 10,
    slotDurationMin: service.slotDurationMin ?? 30,
    slotCapacity: service.slotCapacity ?? 1,
    weekdays: (service.weekdays ?? defaultWeekdays()).map((day) => ({
      weekday: day.weekday,
      openTime: day.openTime,
      closeTime: day.closeTime,
      closed: day.closed,
    })),
  };
}
