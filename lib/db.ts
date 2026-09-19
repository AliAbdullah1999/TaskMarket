import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Cached on globalThis in every environment: dev hot-reloads and separately
// bundled route handlers would otherwise each open their own connection pool.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export const hasDatabaseConfig = Boolean(process.env.DATABASE_URL);
