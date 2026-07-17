/**
 * Remise à zéro du compte Social LinkedIn "Arthur" (resp. Arthur Chazelle).
 *
 * Demande Arthur (17.07.2026) : la vue "Aujourd'hui" affichait 40 actions
 * (10 prospects × 4 étapes en retard toutes dues le même jour) — illisible.
 * On repart propre :
 *   - toute la progression est effacée (4 étapes remises à null, statut EN_COURS)
 *   - 10 prospects démarrent AUJOURD'HUI (étape 1 seulement)
 *   - les 190 autres sont étalés à 10 par JOUR OUVRABLE sur les jours suivants
 *
 * Résultat : aujourd'hui = 10 actions "À liker" et rien d'autre ; la séquence
 * se déroule ensuite naturellement (liker → réagir → se connecter → MP+suivi).
 *
 * Sauvegarde de l'état précédent dans _social-linkedin-arthur-backup.json.
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { assignProspectsFromDate, dateOnly } from "../lib/social-sequence";

const prisma = new PrismaClient();

async function main() {
  const account = await prisma.socialAccount.findFirst({
    where: { nom: "Arthur", reseau: "LINKEDIN" },
    include: {
      prospects: { orderBy: { createdAt: "asc" } },
      responsable: { select: { name: true } },
    },
  });
  if (!account) throw new Error("Compte LinkedIn Arthur introuvable.");
  if (account.responsable.name !== "Arthur Chazelle") {
    throw new Error(`Responsable inattendu : ${account.responsable.name}`);
  }

  writeFileSync(
    "scripts/_social-linkedin-arthur-backup.json",
    JSON.stringify(account, null, 2),
    "utf8",
  );

  const prospects = account.prospects;
  // Aujourd'hui à midi UTC (dateOnly) — évite tout décalage de fuseau.
  const today = dateOnly(new Date());
  const dates = assignProspectsFromDate(prospects.length, today, 10);

  // Une transaction : soit tout le reset passe, soit rien.
  await prisma.$transaction(
    prospects.map((p, i) =>
      prisma.socialProspect.update({
        where: { id: p.id },
        data: {
          dateDemarrage: dates[i]!,
          statut: "EN_COURS",
          step0Done: null,
          step2Done: null,
          step4Done: null,
          step6Done: null,
        },
      }),
    ),
  );

  const parJour = new Map<string, number>();
  for (const d of dates) {
    const k = d.toISOString().slice(0, 10);
    parJour.set(k, (parJour.get(k) ?? 0) + 1);
  }
  console.log(`Reset ✓ — ${prospects.length} prospects, progression effacée.`);
  console.log("Répartition (5 premiers jours) :");
  for (const [k, n] of [...parJour].slice(0, 5)) console.log(`   ${k} : ${n}`);
  console.log(`   … ${parJour.size} jours ouvrables au total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
