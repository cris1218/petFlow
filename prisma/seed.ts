import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const tenantData = {
    name: "Hotel do Ron Ron",
    slug: "hotel-do-ron-ron",
    whatsappNumber: "11988887777",
    whatsappInstanceName: "petflow_hotel-do-ron-ron",
    status: "ACTIVE" as const,
  };

  const existingTenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ slug: "hotel-do-ron-ron" }, { slug: "hotel-patinhas" }],
    },
  });

  const tenant = existingTenant
    ? await prisma.tenant.update({
        where: { id: existingTenant.id },
        data: tenantData,
      })
    : await prisma.tenant.create({ data: tenantData });

  await prisma.user.upsert({
    where: { email: "maria.s@example.com" },
    update: { passwordHash },
    create: {
      tenantId: tenant.id,
      name: "Ana Costa",
      email: "maria.s@example.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const tutor = await prisma.tutor.upsert({
    where: {
      tenantId_phone: { tenantId: tenant.id, phone: "11977776666" },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "João Pereira",
      phone: "11977776666",
      cpf: "12345678901",
      address: "Rua das Acácias, 120",
    },
  });

  let luna = await prisma.pet.findFirst({
    where: { tenantId: tenant.id, tutorId: tutor.id, name: "Luna" },
  });

  if (!luna) {
    luna = await prisma.pet.create({
      data: {
        tenantId: tenant.id,
        tutorId: tutor.id,
        name: "Luna",
        species: "DOG",
        breed: "Golden Retriever",
        size: "LARGE",
        notes: "Adora bolinha e soneca depois do almoço.",
        vaccines: {
          create: [
            {
              tenantId: tenant.id,
              name: "V10",
              applicationDate: new Date("2025-02-10"),
              expirationDate: new Date("2026-02-10"),
              status: "VALID",
            },
            {
              tenantId: tenant.id,
              name: "Raiva",
              applicationDate: new Date("2024-01-15"),
              expirationDate: new Date("2025-01-15"),
              status: "EXPIRED",
            },
          ],
        },
      },
    });
  }

  const today = new Date();
  const checkout = new Date();
  checkout.setDate(today.getDate() + 3);

  const existingStay = await prisma.booking.findFirst({
    where: { tenantId: tenant.id, petId: luna.id, status: "CHECKED_IN" },
  });

  if (!existingStay) {
    await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        petId: luna.id,
        serviceType: "HOTEL",
        startDate: today,
        endDate: checkout,
        status: "CHECKED_IN",
        paymentStatus: "PAID",
        totalAmount: 240,
        depositAmount: 72,
        checklistItems: {
          create: [
            { tenantId: tenant.id, itemName: "Ração 2kg", quantity: 1 },
            { tenantId: tenant.id, itemName: "Coleira", quantity: 1 },
          ],
        },
      },
    });
  }

  console.log("Seed ok: Hotel do Ron Ron · maria.s@example.com / demo1234");
  console.log("Portal público: /agendar/hotel-do-ron-ron");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
