/**
 * Nettoyage : supprime les charges "annuelles forfaitaires" qui ont été
 * posées sur le 1er janvier 2026 à l'import (parce que pas de date source).
 *
 * Logique :
 *   - Pour chaque entrée de charges.json avec date vide → c'était un total
 *     annuel d'abonnement récurrent (Shotstack, Metricool, Workspace, etc.)
 *   - On les retrouve en DB via (description, date == 1er janvier 2026)
 *   - On les supprime → tu les saisiras au fil des relevés réels (vrais
 *     montants, vraies dates d'encaissement)
 */
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();

interface ChargeJson {
  description: string;
  date: string;
  montantCHF: number;
}

async function main() {
  const raw = await readFile(
    join(process.cwd(), "scripts", "import-from-cowork", "charges.json"),
    "utf8",
  );
  const charges = JSON.parse(raw) as ChargeJson[];

  // 1. Identifie les "abonnements annuels sans date" (= entrées source avec date vide)
  const annualCharges = charges.filter((c) => !c.date || !c.date.trim());
  console.log(
    `${annualCharges.length} entrées "abonnement annuel sans date" dans la source.`,
  );

  let removed = 0;
  let totalRemoved = 0;
  // Fenêtre large autour du 1er janvier local Zurich (TZ +1) :
  // l'import a fait `new Date(2026, 0, 1)` → stocké comme 2025-12-31T23:00:00Z
  const winStart = new Date("2025-12-31T22:00:00.000Z");
  const winEnd = new Date("2026-01-02T00:00:00.000Z");

  for (const c of annualCharges) {
    if (!c.description) continue;

    // Trouve la charge correspondante (description + montant + fenêtre 1er janvier)
    const found = await prisma.expense.findFirst({
      where: {
        date: { gte: winStart, lt: winEnd },
        description: c.description,
        montantTTC: c.montantCHF,
      },
    });

    if (!found) {
      console.log(`  ⊘ Pas trouvé : "${c.description}" (${c.montantCHF} CHF)`);
      continue;
    }

    await prisma.expense.delete({ where: { id: found.id } });
    console.log(
      `  ✓ Supprimé : ${c.description.padEnd(50)} ${c.montantCHF.toFixed(2)} CHF`,
    );
    removed++;
    totalRemoved += c.montantCHF;
  }

  console.log(`\n✓ ${removed} charges annuelles supprimées.`);
  console.log(`  Total CHF retiré du 1er janvier : ${totalRemoved.toFixed(2)} CHF`);
  console.log(
    `\nLes vraies charges arriveront au fil des relevés bancaires mensuels.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
