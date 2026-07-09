/**
 * Prisma Client singleton — driver serverless Neon.
 *
 * En serverless (Vercel), une connexion Postgres TCP classique paie un
 * handshake (TCP + TLS + auth) de plusieurs centaines de ms au démarrage à
 * froid d'une lambda. Le driver serverless Neon réduit ça :
 *   - `poolQueryViaFetch = true` → les requêtes SIMPLES passent par HTTP (fetch,
 *     sans handshake WebSocket) : idéal pour couper le cold start.
 *   - les transactions interactives (`$transaction(async tx => …)`) passent par
 *     WebSocket (d'où `webSocketConstructor = ws` en environnement Node).
 *
 * On garde le singleton global pour éviter de recréer le client à chaque
 * hot-reload en dev.
 */
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma(): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
