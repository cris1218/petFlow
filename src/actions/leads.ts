"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterSession } from "@/lib/auth";
import { phoneDigits } from "@/lib/utils";

export async function submitAccessRequest(input: {
  hotelName: string;
  city: string;
  phone: string;
  email: string;
  notes?: string;
}) {
  const hotelName = input.hotelName.trim();
  const city = input.city.trim();
  const phone = phoneDigits(input.phone);
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
