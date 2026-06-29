/**
 * Journal d'audit — trace des actions sensibles (LPD/RGPD + détection d'abus).
 *
 * Usage (dans une server action / route, après l'opération réussie) :
 *   await audit("prospect.delete", { userId: user.id, entity: "Prospect", entityId: id });
 *
 * Règle d'or : un échec d'écriture du log ne doit JAMAIS faire échouer l'action
 * métier → tout est encapsulé dans un try/catch silencieux.
 */
import { headers } from "next/headers";

import { prisma } from "@/lib/db";

interface AuditOptions {
  userId?: string | null;
  entity?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Récupère l'IP appelante (best-effort, derrière proxy/Vercel). */
async function callerIp(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}

export async function audit(action: string, opts: AuditOptions = {}): Promise<void> {
  try {
    const ip = await callerIp();
    await prisma.auditLog.create({
      data: {
        action,
        userId: opts.userId ?? null,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        ip,
        metadata: (opts.metadata ?? undefined) as object | undefined,
      },
    });
  } catch {
    // On n'interrompt jamais l'action métier pour un échec de journalisation.
  }
}
