import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
