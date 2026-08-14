"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterSession } from "@/lib/auth";

export async function listAccessRequests() {
  await requireMasterSession();

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { ok: true as const, leads };
}

export async function deleteAccessRequest(id: string) {
  await requireMasterSession();
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/admin/leads");
  return { ok: true as const };
}
