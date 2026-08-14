import { prisma } from "@/lib/prisma";
import { defaultWeekdays, effectiveServiceKind, type ServiceKind } from "@/lib/schedule";

export const FIXED_SERVICES = [
  { key: "hotel", name: "Hotel", kind: "STAY" as const, price: 80, sortOrder: 0 },
  { key: "creche", name: "Creche / diária", kind: "DAYCARE" as const, price: 50, sortOrder: 1 },
  { key: "petsitter", name: "Petsitter", kind: "DAYCARE" as const, price: 50, sortOrder: 2 },
  { key: "grooming", name: "Banho e tosa", kind: "APPOINTMENT" as const, price: 70, sortOrder: 3 },
] as const;

export type FixedServiceKey = (typeof FIXED_SERVICES)[number]["key"];

export const DEFAULT_TENANT_SERVICES = FIXED_SERVICES;

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

function serviceCreateData(spec: (typeof FIXED_SERVICES)[number]) {
  const base = {
    name: spec.name,
    price: spec.price,
    sortOrder: spec.sortOrder,
    active: true,
    kind: spec.kind,
  };
  if (spec.kind === "STAY") {
    return { ...base, dailyCutoffTime: "12:00", catCapacity: 10, dogCapacity: 10 };
  }
  if (spec.kind === "DAYCARE") {
    return { ...base, periodCapacity: 10, weekdays: { create: defaultWeekdays() } };
  }
  return {
    ...base,
    slotDurationMin: 30,
    slotCapacity: 1,
    weekdays: { create: defaultWeekdays() },
  };
}

export function defaultServicesCreate() {
  return FIXED_SERVICES.map(serviceCreateData);
}

export function matchFixedServiceKey(name: string, kind: ServiceKind): FixedServiceKey | null {
  const normalized = name.trim().toLowerCase();
  if (normalized === "banho e tosa" || /(banho|tosa|groom)/i.test(name)) return "grooming";
  if (normalized === "petsitter" || /(petsit|pet[\s-]?sitter)/i.test(name)) return "petsitter";
  if (
    normalized === "creche / diária" ||
    normalized === "creche / diaria" ||
    normalized === "creche" ||
    /(creche|day\s?care)/i.test(name)
  ) {
    return "creche";
  }
  if (normalized === "hotel" || kind === "STAY") return "hotel";
  if (kind === "APPOINTMENT") return "grooming";
  if (kind === "DAYCARE") return "creche";
  return null;
}

export async function ensureTenantServices(tenant: { id: string }) {
  const existing = await prisma.tenantService.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const assigned = new Map<FixedServiceKey, string>();

  for (const service of existing) {
    const key = matchFixedServiceKey(
      service.name,
      effectiveServiceKind(service.kind, service.name),
    );
    if (!key || assigned.has(key)) continue;
    assigned.set(key, service.id);
  }

  for (const spec of FIXED_SERVICES) {
    const id = assigned.get(spec.key);
    if (!id) {
      await prisma.tenantService.create({
        data: {
          ...serviceCreateData(spec),
          tenantId: tenant.id,
        },
      });
      continue;
    }
    await prisma.tenantService.update({
      where: { id },
      data: {
        name: spec.name,
        kind: spec.kind,
        sortOrder: spec.sortOrder,
      },
    });
  }

  const kept = new Set(assigned.values());
  const extras = existing.filter((service) => !kept.has(service.id));
  if (extras.length) {
    await prisma.tenantService.updateMany({
      where: { id: { in: extras.map((service) => service.id) } },
      data: { active: false },
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
