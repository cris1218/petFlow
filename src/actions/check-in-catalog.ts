"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { serializeCatalogItem } from "@/lib/check-in-catalog";

function revalidateCheckIn() {
  revalidatePath("/dashboard/check-in");
}

export async function createTenantBelonging(name: string) {
  const { tenantId, user } = await requireStaffSession();
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { ok: false as const, error: "Informe o nome do pertence." };
  }

  const last = await prisma.tenantBelonging.findFirst({
    where: { tenantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const item = await prisma.tenantBelonging.create({
    data: {
      tenantId,
      name: trimmed,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidateCheckIn();
  revalidatePath(`/agendar/${user.tenant.slug}`);
  return { ok: true as const, item: serializeCatalogItem(item) };
}

export async function deleteTenantBelonging(id: string) {
  const { tenantId, user } = await requireStaffSession();
  const current = await prisma.tenantBelonging.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!current) {
    return { ok: false as const, error: "Pertence não encontrado." };
  }
  await prisma.tenantBelonging.delete({ where: { id: current.id } });
  revalidateCheckIn();
  revalidatePath(`/agendar/${user.tenant.slug}`);
  return { ok: true as const };
}

export async function createRequiredVaccine(name: string) {
  const { tenantId, user } = await requireStaffSession();
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { ok: false as const, error: "Informe o nome da vacina." };
  }

  const last = await prisma.tenantRequiredVaccine.findFirst({
    where: { tenantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const item = await prisma.tenantRequiredVaccine.create({
    data: {
      tenantId,
      name: trimmed,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidateCheckIn();
  revalidatePath(`/agendar/${user.tenant.slug}`);
  return { ok: true as const, item: serializeCatalogItem(item) };
}

export async function deleteRequiredVaccine(id: string) {
  const { tenantId, user } = await requireStaffSession();
  const current = await prisma.tenantRequiredVaccine.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!current) {
    return { ok: false as const, error: "Vacina não encontrada." };
  }
  await prisma.tenantRequiredVaccine.delete({ where: { id: current.id } });
  revalidateCheckIn();
  revalidatePath(`/agendar/${user.tenant.slug}`);
  return { ok: true as const };
}
