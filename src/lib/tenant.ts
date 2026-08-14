import { prisma } from "@/lib/prisma";

export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
  });
}

export async function listPublicPortals() {
  return prisma.tenant.findMany({
    where: { status: { not: "SUSPENDED" } },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
    },
    orderBy: { name: "asc" },
  });
}

export function tenantWhere(tenantId: string) {
  return { tenantId };
}

export async function assertOwnedBooking(tenantId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    include: {
      pet: { include: { tutor: true, vaccines: true } },
      checklistItems: true,
      dailyLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!booking) {
    throw new Error("Reserva não encontrada neste estabelecimento.");
  }

  return booking;
}
