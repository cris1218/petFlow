"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { TenantStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMasterSession } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { deleteWhatsAppInstance } from "@/lib/whatsapp";
import { getBillingState } from "@/lib/billing";
import { defaultServicesCreate } from "@/lib/services";
import { defaultBelongingsCreate, defaultVaccinesCreate } from "@/lib/check-in-catalog";
import { defaultWeekdays } from "@/lib/schedule";

export async function listHotels() {
  await requireMasterSession();

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        where: { role: "ADMIN" },
        select: { name: true, email: true },
        take: 3,
      },
      _count: { select: { bookings: true, users: true } },
      subscriptionPayments: {
        where: { status: "PENDING" },
        select: { id: true },
        take: 1,
      },
    },
  });

  return tenants.map((tenant) => {
    const billing = getBillingState(
      tenant.createdAt,
      tenant._count.users,
      tenant.billingPaidUntil,
    );
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      whatsappConnected: tenant.whatsappConnected,
      createdAt: tenant.createdAt,
      admins: tenant.users,
      bookingCount: tenant._count.bookings,
      userCount: tenant._count.users,
      hasPendingPix: tenant.subscriptionPayments.length > 0,
      billing,
    };
  });
}

export async function createHotel(input: {
  name: string;
  slug?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}) {
  await requireMasterSession();

  const name = input.name.trim();
  const slug = slugify(input.slug?.trim() || name);
  const adminName = input.adminName.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  const adminPassword = input.adminPassword;

  if (name.length < 2) {
    return { ok: false as const, error: "Informe o nome do hotel." };
  }
  if (!slug) {
    return { ok: false as const, error: "Slug inválido." };
  }
  if (adminName.length < 2) {
    return { ok: false as const, error: "Informe o nome do gestor." };
  }
  if (!adminEmail.includes("@")) {
    return { ok: false as const, error: "E-mail do gestor inválido." };
  }
  if (adminPassword.length < 6) {
    return { ok: false as const, error: "Senha do gestor deve ter ao menos 6 caracteres." };
  }

  const [slugTaken, emailTaken] = await Promise.all([
    prisma.tenant.findUnique({ where: { slug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } }),
  ]);

  if (slugTaken) {
    return { ok: false as const, error: "Já existe um hotel com esse slug." };
  }
  if (emailTaken) {
    return { ok: false as const, error: "Esse e-mail já está em uso." };
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      status: "TRIAL",
      whatsappInstanceName: `petflow_${slug}`,
      users: {
        create: {
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
        },
      },
      services: {
        create: defaultServicesCreate(),
      },
      belongings: {
        create: defaultBelongingsCreate(),
      },
      requiredVaccines: {
        create: defaultVaccinesCreate(),
      },
      weekdays: {
        create: defaultWeekdays(),
      },
    },
  });

  revalidatePath("/admin");
  return {
    ok: true as const,
    tenantId: tenant.id,
    slug: tenant.slug,
  };
}

export async function setHotelStatus(tenantId: string, status: TenantStatus) {
  await requireMasterSession();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { status },
  });
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function deleteHotel(tenantId: string) {
  await requireMasterSession();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, whatsappInstanceName: true, slug: true },
  });

  if (!tenant) {
    return { ok: false as const, error: "Hotel não encontrado." };
  }

  const instanceName =
    tenant.whatsappInstanceName ?? `petflow_${tenant.slug}`;

  await prisma.$transaction(async (tx) => {
    await tx.supportMessage.deleteMany({
      where: { ticket: { tenantId } },
    });
    await tx.supportTicket.deleteMany({ where: { tenantId } });
    await tx.checklistItem.deleteMany({ where: { tenantId } });
    await tx.dailyLog.deleteMany({ where: { tenantId } });
    await tx.booking.deleteMany({ where: { tenantId } });
    await tx.vaccine.deleteMany({ where: { tenantId } });
    await tx.pet.deleteMany({ where: { tenantId } });
    await tx.tutor.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });

  try {
    await deleteWhatsAppInstance(instanceName);
  } catch (error) {
    console.error("[deleteHotel] evolution", error);
  }

  revalidatePath("/admin");
  return { ok: true as const };
}

export async function getHotelUsers(tenantId: string) {
  await requireMasterSession();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      users: {
        where: { role: { not: "MASTER" } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      },
    },
  });

  if (!tenant) {
    return { ok: false as const, error: "Hotel não encontrado." };
  }

  return { ok: true as const, tenant };
}

export async function resetHotelUserPassword(input: {
  tenantId: string;
  userId: string;
  newPassword: string;
}) {
  await requireMasterSession();

  const password = input.newPassword.trim();
  if (password.length < 6) {
    return { ok: false as const, error: "A senha deve ter ao menos 6 caracteres." };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      tenantId: input.tenantId,
      role: { not: "MASTER" },
    },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return { ok: false as const, error: "Usuário não encontrado neste hotel." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  revalidatePath(`/admin/hoteis/${input.tenantId}`);
  return {
    ok: true as const,
    email: user.email,
    name: user.name,
    password,
  };
}
