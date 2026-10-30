/**
 * APPLIQUE le re-typage des activités « SCI DJAIMM » (RDV_* → NOTE).
 * Choix validé par Arthur (option a). DB uniquement — AUCUN appel Google :
 *  - le push Google n'est déclenché que par les actions applicatives, pas par
 *    un updateMany direct ; les events Google restent donc inchangés ;
 *  - le pull ne réécrit jamais le `type` d'une activité existante → durable.
 * Un backup des IDs (type d'origine) est écrit pour réversibilité.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const RDV_TYPES = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] as const;
const WHERE = {
  type: { in: RDV_TYPES as unknown as any },
  sujet: { contains: "SCI DJAIMM", mode: "insensitive" as const },
};

async function main() {
  const now = new Date();

  // 1) Sanity : re-compter le lot, refuser si l'écart au dry-run est anormal.
  const before = await prisma.activity.count({ where: WHERE });
  console.log(`Lot RDV_* « SCI DJAIMM » avant: ${before}`);
  if (before === 0) {
    console.log("Rien à faire (0).");
    return;
  }
  if (before > 800) {
    throw new Error(`Garde-fou: ${before} > 800, écart anormal au dry-run (745). Abandon.`);
  }

  // 2) Backup des IDs + type d'origine (réversibilité).
  const rows = await prisma.activity.findMany({
    where: WHERE,
    select: { id: true, type: true, statut: true, date: true, googleEventId: true },
  });
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const backupPath = join(process.cwd(), "scripts", `_djaimm-retype-backup-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify({ when: now.toISOString(), count: rows.length, rows }, null, 2), "utf8");
  console.log(`Backup écrit: ${backupPath} (${rows.length} lignes)`);

  // 3) Re-typage → NOTE (on ne touche QUE le type ; statut/date/googleEventId intacts).
  const res = await prisma.activity.updateMany({ where: WHERE, data: { type: "NOTE" } });
  console.log(`updateMany → NOTE: ${res.count} lignes modifiées.`);

  // 4) Vérifications post-application.
  const stillRdv = await prisma.activity.count({ where: WHERE });
  const nowNote = await prisma.activity.count({
    where: { type: "NOTE", sujet: { contains: "SCI DJAIMM", mode: "insensitive" } },
  });
  const arthur = await prisma.user.findFirst({
    where: { email: { contains: "contact@makeyourcom" } },
    select: { id: true, name: true },
  });
  const arthurRdvFuturs = arthur
    ? await prisma.activity.count({
        where: { userId: arthur.id, type: { in: RDV_TYPES as unknown as any }, date: { gt: now } },
      })
    : -1;

  console.log("\n=== Vérification ===");
  console.log(`RDV_* « SCI DJAIMM » restants: ${stillRdv} (attendu 0)`);
  console.log(`NOTE « SCI DJAIMM »: ${nowNote} (attendu ${before})`);
  console.log(`RDV_* futurs d'Arthur (tous sujets): ${arthurRdvFuturs} (attendu ~3)`);
}

main()
  .catch((e) => { console.error("ERREUR:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
