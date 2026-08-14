import { prisma } from "@/lib/prisma";

export const DEFAULT_BELONGINGS = [
  { name: "Ração", sortOrder: 0 },
  { name: "Medicação", sortOrder: 1 },
  { name: "Coleira", sortOrder: 2 },
  { name: "Cama / toalha", sortOrder: 3 },
] as const;

export const DEFAULT_REQUIRED_VACCINES = [
  { name: "V10", sortOrder: 0 },
  { name: "Raiva", sortOrder: 1 },
] as const;

export function defaultBelongingsCreate() {
  return DEFAULT_BELONGINGS.map((item) => ({
    name: item.name,
    sortOrder: item.sortOrder,
  }));
}

export function defaultVaccinesCreate() {
  return DEFAULT_REQUIRED_VACCINES.map((item) => ({
    name: item.name,
    sortOrder: item.sortOrder,
  }));
}

export function serializeCatalogItem(item: { id: string; name: string }) {
  return { id: item.id, name: item.name };
}

export async function ensureCheckInCatalog(tenantId: string) {
  const [belongingCount, vaccineCount] = await Promise.all([
    prisma.tenantBelonging.count({ where: { tenantId } }),
    prisma.tenantRequiredVaccine.count({ where: { tenantId } }),
  ]);

  if (belongingCount === 0) {
    await prisma.tenantBelonging.createMany({
      data: defaultBelongingsCreate().map((item) => ({ ...item, tenantId })),
    });
  }

  if (vaccineCount === 0) {
    await prisma.tenantRequiredVaccine.createMany({
      data: defaultVaccinesCreate().map((item) => ({ ...item, tenantId })),
    });
  }
}
