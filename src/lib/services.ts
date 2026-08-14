import { prisma } from "@/lib/prisma";

export const DEFAULT_TENANT_SERVICES = [
  { name: "Hotel", price: 80, sortOrder: 0, kind: "STAY" as const },
  { name: "Creche / diária", price: 50, sortOrder: 1, kind: "STAY" as const },
  { name: "Banho e tosa", price: 70, sortOrder: 2, kind: "APPOINTMENT" as const },
] as const;

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
    },
    {
      name: "Creche / diária",
      price: Number(rates?.daycareRate ?? DEFAULT_TENANT_SERVICES[1].price),
      sortOrder: 1,
      active: true,
      kind: "STAY" as const,
    },
    {
      name: "Banho e tosa",
      price: Number(rates?.groomingRate ?? DEFAULT_TENANT_SERVICES[2].price),
      sortOrder: 2,
      active: true,
      kind: "APPOINTMENT" as const,
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

  await prisma.tenantService.createMany({
    data: defaultServicesCreate(tenant).map((service) => ({
      ...service,
      tenantId: tenant.id,
    })),
  });
}

export function serializeTenantService(service: {
  id: string;
  name: string;
  price: { toString(): string } | number;
  kind: "STAY" | "APPOINTMENT";
  active: boolean;
  sortOrder: number;
}) {
  return {
    id: service.id,
    name: service.name,
    price: Number(service.price),
    kind: service.kind,
    active: service.active,
    sortOrder: service.sortOrder,
  };
}
