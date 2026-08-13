import { PrismaClient } from "@prisma/client";
import { readEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const url = readEnv("DATABASE_URL");

  if (!url || url.includes("@HOST") || url.includes("[YOUR-PASSWORD]")) {
    throw new Error(
      "DATABASE_URL inválida no .env. Use a URI do pooler do Supabase e reinicie o yarn dev.",
    );
  }

  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
