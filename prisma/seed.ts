import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient() as PrismaClient & {
  tenantService: {
    count: (args: { where: { tenantId: string } }) => Promise<number>;
    createMany: (args: {
      data: Array<{
        tenantId: string;
        name: string;
        price: number;
        sortOrder: number;
        active: boolean;
        kind: "STAY" | "DAYCARE" | "APPOINTMENT";
      }>;
    }) => Promise<unknown>;
    updateMany: (args: {
      where: { tenantId: string; name: string };
      data: { kind: "STAY" | "DAYCARE" | "APPOINTMENT" };
    }) => Promise<unknown>;
  };
};

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
    : await prisma.tenant.create({
        data: tenantData,
      });

  const serviceCount = await prisma.tenantService.count({
    where: { tenantId: tenant.id },
  });
  if (serviceCount === 0) {
    await prisma.tenantService.createMany({
      data: [
        { tenantId: tenant.id, name: "Hotel", price: 80, sortOrder: 0, active: true, kind: "STAY" },
        { tenantId: tenant.id, name: "Creche / diária", price: 50, sortOrder: 1, active: true, kind: "DAYCARE" },
        { tenantId: tenant.id, name: "Petsitter", price: 50, sortOrder: 2, active: true, kind: "DAYCARE" },
        { tenantId: tenant.id, name: "Banho e tosa", price: 70, sortOrder: 3, active: true, kind: "APPOINTMENT" },
      ],
    });
  } else {
    await prisma.tenantService.updateMany({
      where: { tenantId: tenant.id, name: "Banho e tosa" },
      data: { kind: "APPOINTMENT" },
    });
    await prisma.tenantService.updateMany({
      where: { tenantId: tenant.id, name: "Creche / diária" },
      data: { kind: "DAYCARE" },
    });
    await prisma.tenantService.updateMany({
      where: { tenantId: tenant.id, name: "Creche" },
      data: { kind: "DAYCARE" },
    });
  }

  await prisma.user.upsert({
    where: { email: "maria.s@example.com" },
    update: { tenantId: tenant.id, name: "Ana Costa", role: "ADMIN" },
    create: {
      tenantId: tenant.id,
      name: "Ana Costa",
      email: "maria.s@example.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const masterEmail = (process.env.MASTER_EMAIL || "iris.p@example.org").toLowerCase();
  const existingMaster = await prisma.user.findFirst({
    where: { role: "MASTER" },
  });
  if (!existingMaster) {
    await prisma.user.create({
      data: {
        tenantId: null,
        name: "Master PetFlow",
        email: masterEmail,
        passwordHash: await bcrypt.hash(
          process.env.MASTER_PASSWORD || "altere-esta-senha",
          10,
        ),
        role: "MASTER",
      },
    });
    console.log(`Master criado: ${masterEmail}`);
  }

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
