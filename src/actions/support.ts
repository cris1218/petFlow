"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterSession, requireStaffSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";

function preview(body: string) {
  const text = body.trim().replace(/\s+/g, " ");
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function revalidateTicket(ticketId: string) {
  revalidatePath("/dashboard/suporte");
  revalidatePath(`/dashboard/suporte/${ticketId}`);
  revalidatePath("/admin/suporte");
  revalidatePath(`/admin/suporte/${ticketId}`);
}

export async function createSupportTicket(input: {
  subject: string;
  body: string;
}) {
  const { session, tenantId } = await requireStaffSession();
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (subject.length < 3) {
    return { ok: false as const, error: "Informe o assunto do pedido." };
  }
  if (body.length < 5) {
    return { ok: false as const, error: "Descreva o que precisa de ajuda." };
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId,
      authorId: session.userId,
      subject,
      status: "OPEN",
      messages: {
        create: {
          authorId: session.userId,
          body,
          fromMaster: false,
        },
      },
    },
    select: { id: true },
  });

  revalidateTicket(ticket.id);
  return { ok: true as const, ticketId: ticket.id };
}

export async function listHotelsForSupport() {
  await requireMasterSession();

  return prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      users: {
        where: { role: { in: ["ADMIN", "STAFF"] } },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: { name: true, role: true },
      },
    },
  });
}

export async function createMasterSupportTicket(input: {
  tenantId: string;
  subject: string;
  body: string;
}) {
  const { user } = await requireMasterSession();
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (!input.tenantId) {
    return { ok: false as const, error: "Escolha o hotel." };
  }
  if (subject.length < 3) {
    return { ok: false as const, error: "Informe o assunto do chamado." };
  }
  if (body.length < 5) {
    return { ok: false as const, error: "Escreva a mensagem." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true },
  });
  if (!tenant) {
    return { ok: false as const, error: "Hotel não encontrado." };
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId: tenant.id,
      authorId: user.id,
      subject,
      status: "WAITING_HOTEL",
      messages: {
        create: {
          authorId: user.id,
          body,
          fromMaster: true,
        },
      },
    },
    select: { id: true },
  });

  revalidateTicket(ticket.id);
  return { ok: true as const, ticketId: ticket.id };
}

export async function listHotelSupportTickets() {
  const { tenantId } = await requireStaffSession();

  const tickets = await prisma.supportTicket.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { name: true, role: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true },
      },
    },
  });

  return tickets.map((ticket) => ({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    lastMessage: ticket.messages[0] ? preview(ticket.messages[0].body) : "",
    openedByMaster: ticket.author.role === "MASTER",
    authorName: ticket.author.role === "MASTER" ? APP_NAME : ticket.author.name,
  }));
}

export async function getHotelSupportTicket(ticketId: string) {
  const { tenantId } = await requireStaffSession();

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, tenantId },
    include: {
      author: { select: { name: true, role: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });

  if (!ticket) {
    return { ok: false as const, error: "Pedido não encontrado." };
  }

  return { ok: true as const, ticket };
}

export async function replyHotelSupportTicket(input: {
  ticketId: string;
  body: string;
}) {
  const { session, tenantId } = await requireStaffSession();
  const body = input.body.trim();

  if (body.length < 2) {
    return { ok: false as const, error: "Escreva a mensagem." };
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: input.ticketId, tenantId },
    select: { id: true, status: true },
  });

  if (!ticket) {
    return { ok: false as const, error: "Pedido não encontrado." };
  }
  if (ticket.status === "CLOSED") {
    return {
      ok: false as const,
      error: "Este pedido foi encerrado. Abra um novo se ainda precisar de ajuda.",
    };
  }

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: session.userId,
        body,
        fromMaster: false,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "WAITING_MASTER" },
    }),
  ]);

  revalidateTicket(ticket.id);
  return { ok: true as const };
}

export async function listMasterSupportTickets(filter?: string) {
  await requireMasterSession();

  const tickets = await prisma.supportTicket.findMany({
    where:
      filter === "closed"
        ? { status: "CLOSED" }
        : filter === "waiting-hotel"
          ? { status: "WAITING_HOTEL" }
          : filter === "pending"
            ? { status: { in: ["OPEN", "WAITING_MASTER"] } }
            : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      tenant: { select: { name: true, slug: true } },
      author: { select: { name: true, role: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true },
      },
    },
  });

  const counts = await prisma.supportTicket.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const byStatus = Object.fromEntries(
    counts.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  return {
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      hotelName: ticket.tenant.name,
      hotelSlug: ticket.tenant.slug,
      lastMessage: ticket.messages[0] ? preview(ticket.messages[0].body) : "",
      openedByMaster: ticket.author.role === "MASTER",
    })),
    counts: {
      pending: (byStatus.OPEN ?? 0) + (byStatus.WAITING_MASTER ?? 0),
      waitingHotel: byStatus.WAITING_HOTEL ?? 0,
      closed: byStatus.CLOSED ?? 0,
      all: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
    },
  };
}

export async function getMasterSupportTicket(ticketId: string) {
  await requireMasterSession();

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      author: { select: { name: true, email: true, role: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });

  if (!ticket) {
    return { ok: false as const, error: "Pedido não encontrado." };
  }

  return { ok: true as const, ticket };
}

export async function replyMasterSupportTicket(input: {
  ticketId: string;
  body: string;
}) {
  const { user } = await requireMasterSession();
  const body = input.body.trim();

  if (body.length < 2) {
    return { ok: false as const, error: "Escreva a resposta." };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, status: true },
  });

  if (!ticket) {
    return { ok: false as const, error: "Pedido não encontrado." };
  }
  if (ticket.status === "CLOSED") {
    return { ok: false as const, error: "Este pedido já foi encerrado." };
  }

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body,
        fromMaster: true,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "WAITING_HOTEL" },
    }),
  ]);

  revalidateTicket(ticket.id);
  return { ok: true as const };
}

export async function closeSupportTicket(ticketId: string) {
  await requireMasterSession();

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (!ticket) {
    return { ok: false as const, error: "Pedido não encontrado." };
  }

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "CLOSED" },
  });

  revalidateTicket(ticket.id);
  return { ok: true as const };
}

export async function reopenSupportTicket(ticketId: string) {
  await requireMasterSession();

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });

  if (!ticket) {
    return { ok: false as const, error: "Pedido não encontrado." };
  }

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "WAITING_MASTER" },
  });

  revalidateTicket(ticket.id);
  return { ok: true as const };
}
