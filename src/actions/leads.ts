"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform";

export async function submitAccessRequest(input: {
  hotelName: string;
  city: string;
  phone: string;
  email: string;
  notes?: string;
}) {
  const hotelName = input.hotelName.trim();
  const city = input.city.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();

  if (hotelName.length < 2 || city.length < 2 || phone.length < 10) {
    return { ok: false as const, error: "Preencha hotel, cidade e WhatsApp." };
  }
  if (!email.includes("@")) {
    return { ok: false as const, error: "E-mail inválido." };
  }

  await prisma.lead.create({
    data: {
      hotelName,
      city,
      phone,
      email,
      notes: input.notes?.trim() || null,
    },
  });

  return { ok: true as const };
}

export async function listAccessRequests() {
  const { user } = await requireStaffSession();
  if (!isPlatformAdmin(user.email)) {
    return { ok: false as const, error: "Sem permissão." };
  }

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { ok: true as const, leads };
}

export async function deleteAccessRequest(id: string) {
  const { user } = await requireStaffSession();
  if (!isPlatformAdmin(user.email)) {
    return { ok: false as const, error: "Sem permissão." };
  }
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/dashboard/leads");
  return { ok: true as const };
}
