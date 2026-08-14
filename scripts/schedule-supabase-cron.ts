import { PrismaClient } from "@prisma/client";
import { readEnv } from "@/lib/env";
import fs from "node:fs";
import path from "node:path";

const JOBS = [
  { name: "petflow-daily-logs", schedule: "* * * * *", path: "/api/cron/daily-logs" },
  { name: "petflow-reminders", schedule: "0 12 * * *", path: "/api/cron/reminders" },
] as const;

function readLocalEnv(key: string) {
  const fromEnv = readEnv(key);
  if (fromEnv) return fromEnv;
  const localPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(localPath)) return undefined;
  for (const line of fs.readFileSync(localPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    if (trimmed.slice(0, separator) !== key) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

function sqlString(value: string) {
  return value.replace(/'/g, "''");
}

async function main() {
  const directUrl = readLocalEnv("DIRECT_URL");
  const secret = readLocalEnv("CRON_SECRET");
  const appUrl = (
    process.argv[2] ||
    readLocalEnv("CRON_TARGET_URL") ||
    readLocalEnv("APP_URL") ||
    ""
  ).replace(/\/$/, "");

  if (!directUrl) {
    throw new Error("DIRECT_URL não encontrado no .env");
  }
  if (!secret || secret.includes("troque")) {
    throw new Error("CRON_SECRET precisa estar definido (o mesmo da Vercel).");
  }
  if (!appUrl.startsWith("https://")) {
    throw new Error(
      "Passe a URL https da Vercel: yarn db:cron https://seu-app.vercel.app",
    );
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: directUrl } },
  });

  try {
    await prisma.$executeRawUnsafe(
      `create extension if not exists pg_cron with schema pg_catalog`,
    );
    await prisma.$executeRawUnsafe(`create extension if not exists pg_net`);

    for (const job of JOBS) {
      const endpoint = `${appUrl}${job.path}`;
      await prisma.$executeRawUnsafe(`
        do $$
        declare
          existing integer;
        begin
          select jobid into existing from cron.job where jobname = '${sqlString(job.name)}';
          if existing is not null then
            perform cron.unschedule(existing);
          end if;
        end $$;
      `);

      const command = `select net.http_get(url := '${sqlString(endpoint)}', headers := jsonb_build_object('Authorization', 'Bearer ${sqlString(secret)}', 'Content-Type', 'application/json'), timeout_milliseconds := 15000)`;

      await prisma.$queryRawUnsafe(
        `select cron.schedule('${sqlString(job.name)}', '${job.schedule}', '${sqlString(command)}')`,
      );

      console.log("Cron do Supabase ativo:", job.name, job.schedule, "→", endpoint);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
