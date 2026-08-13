import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "petflow_session";

export type SessionPayload = {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET não configurado.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  cookies().delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireStaffSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Não autenticado.");
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId },
    include: { tenant: true },
  });

  if (!user || user.tenant.status === "SUSPENDED") {
    throw new Error("Sessão inválida.");
  }

  return { session, user, tenantId: session.tenantId };
}
