/**
 * Prisma Client singleton.
 *
 * En dev avec le hot-reload Next.js, on évite de créer une nouvelle instance
 * du client à chaque rechargement de module — sinon Postgres se retrouve
 * saturé de connexions ouvertes en quelques minutes.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
