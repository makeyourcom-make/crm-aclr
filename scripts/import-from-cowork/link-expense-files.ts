/**
 * Lie les tickets/PDFs du dossier "09. Charges" aux Expense en DB.
 *
 * Stratégie :
 *   1. Extraction de références dans le nom de fichier (FC-XXX, GJYLUZ-XXXX,
 *      JWBLWCBD-XXXX, GCFRD..., etc.)
 *   2. Recherche de ces références dans les notes des charges importées
 *   3. Fallback : mots-clés + mois
 *
 * Mode dry-run par défaut. Lancer avec --execute pour appliquer.
 */
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();
const DRY = !process.argv.includes("--execute");

const SOURCE_DIR =
  "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges";
const PUBLIC_EXPENSES_DIR =
  "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\04. Make Your Com\\CRM\\public\\expenses";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cherche des références identifiables dans le nom de fichier. */
function extractRefs(fileName: string): string[] {
  const refs: string[] = [];
  const patterns = [
    /FC[-_]?\d{7}/gi, // LWS : FC-2676651
    /GJYLUZ[-_]?\d{5}/gi, // Netlify : GJYLUZ-00007
    /JWBLWCBD[-_]?\d{4}/gi, // Claude : JWBLWCBD-0006
    /GCFRD\d{10,}/gi, // Google Workspace
    /\d{7,}/g, // Toute série de chiffres longue (numéros invoice)
  ];
  for (const p of patterns) {
    const matches = fileName.match(p);
    if (matches) refs.push(...matches.map((m) => m.toUpperCase()));
  }
  return [...new Set(refs)];
}

function detectMonth(s: string): number | null {
  const map: Record<string, number> = {
    janvier: 0, janv: 0, jan: 0,
    fevrier: 1, fev: 1,
    mars: 2, mar: 2,
    avril: 3, avr: 3,
    mai: 4,
    juin: 5,
    juillet: 6, juil: 6,
    aout: 7,
    septembre: 8, sept: 8, sep: 8,
    octobre: 9, oct: 9,
    novembre: 10, nov: 10,
    decembre: 11, dec: 11,
  };
  const n = norm(s);
  for (const [k, v] of Object.entries(map)) {
    if (new RegExp("\\b" + k + "\\b").test(n)) return v;
  }
  return null;
}

interface ExpenseLite {
  id: string;
  description: string | null;
  date: Date;
  montantTTC: number;
  notes: string;
  reference: string | null;
  ticketUrl: string | null;
}

interface MatchResult {
  fileName: string;
  matched?: ExpenseLite;
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
}

function matchFile(fileName: string, expenses: ExpenseLite[]): MatchResult {
  const available = expenses.filter((e) => !e.ticketUrl);
  const nameN = norm(fileName);
  const fileMonth = detectMonth(fileName);
  const refs = extractRefs(fileName);

  // === ÉTAPE 1 — match par référence dans notes ===
  for (const ref of refs) {
    const refN = ref.replace(/[-_]/g, "");
    const matches = available.filter((e) => {
      const notesN = (e.notes || "").toUpperCase().replace(/[-_\s]/g, "");
      return notesN.includes(refN);
    });
    if (matches.length === 1) {
      return {
        fileName,
        matched: matches[0],
        confidence: "high",
        reason: `ref:${ref}`,
      };
    }
    if (matches.length > 1) {
      // Si plusieurs match par ref, filtre par mois
      if (fileMonth !== null) {
        const byMonth = matches.filter(
          (e) => e.date.getUTCMonth() === fileMonth,
        );
        if (byMonth.length === 1) {
          return {
            fileName,
            matched: byMonth[0],
            confidence: "high",
            reason: `ref:${ref}+month`,
          };
        }
      }
    }
  }

  // === ÉTAPE 2 — match par mot-clé description ===
  const keywords: Array<{ patterns: string[]; descMatch: string[] }> = [
    { patterns: ["sunrise"], descMatch: ["sunrise"] },
    { patterns: ["workspace"], descMatch: ["google workspace"] },
    { patterns: ["lws"], descMatch: ["lws"] },
    { patterns: ["netlify"], descMatch: ["netlify"] },
    { patterns: ["claude"], descMatch: ["claude"] },
    { patterns: ["elementor"], descMatch: ["elementor"] },
    { patterns: ["lucas"], descMatch: ["lucas"] },
    { patterns: ["cff"], descMatch: ["cff"] },
    { patterns: ["sigma"], descMatch: ["sigma"] },
    { patterns: ["make automatis", "make extra"], descMatch: ["make"] },
    { patterns: ["timbre"], descMatch: ["timbres"] },
    { patterns: ["boite postal", "case postale"], descMatch: ["case postale"] },
    { patterns: ["cafe", "café", "fratellini", "burger", "mcdonald"], descMatch: ["restaurant", "burger", "café"] },
    { patterns: ["repas"], descMatch: ["restaurant"] },
    { patterns: ["invitation"], descMatch: ["invitation"] },
    { patterns: ["deplacement"], descMatch: ["deplacement"] },
    { patterns: ["ticket"], descMatch: ["case postale"] }, // fallback
  ];

  let candidates = available;
  let reason = "";
  let confidence: MatchResult["confidence"] = "none";

  for (const kw of keywords) {
    if (kw.patterns.some((p) => nameN.includes(norm(p)))) {
      const filtered = candidates.filter((e) =>
        kw.descMatch.some((dm) => norm(e.description ?? "").includes(norm(dm))),
      );
      if (filtered.length > 0) {
        candidates = filtered;
        reason = `kw:${kw.patterns[0]}`;
        confidence = "medium";
        break;
      }
    }
  }

  if (candidates.length === available.length) {
    return { fileName, confidence: "none", reason: "no keyword match" };
  }

  // === ÉTAPE 3 — filtre par mois ===
  if (fileMonth !== null) {
    const byMonth = candidates.filter(
      (e) => e.date.getUTCMonth() === fileMonth,
    );
    if (byMonth.length > 0) {
      candidates = byMonth;
      reason += `+month:${fileMonth + 1}`;
      confidence = confidence === "medium" ? "high" : "medium";
    }
  }

  // Résultat
  if (candidates.length === 1) {
    return { fileName, matched: candidates[0], confidence, reason };
  }
  if (candidates.length > 1) {
    return {
      fileName,
      confidence: "low",
      reason: `${candidates.length} candidats: ${candidates
        .slice(0, 3)
        .map((c) => `${(c.description ?? "").slice(0, 30)} (${c.montantTTC.toFixed(2)})`)
        .join(" / ")}`,
    };
  }
  return { fileName, confidence: "none", reason: "no candidate" };
}

async function main() {
  console.log(`Mode : ${DRY ? "DRY-RUN" : "EXÉCUTION"}\n`);

  const rawExpenses = await prisma.expense.findMany({
    select: {
      id: true,
      description: true,
      date: true,
      montantTTC: true,
      reference: true,
      ticketUrl: true,
    },
  });

  // Récupère les notes via une 2nde requête (les notes sont dans Expense.description du JSON, mais ici les Expense ont peut-être des notes dans le champ qui n'est pas exposé. Cherchons dans le champ qui contient les refs)
  // En réalité les "notes" sont dans le champ description du JSON source, copiées dans Expense.description. Donc je m'appuie sur description directement.
  // Mais les références FC-XXXX sont dans les notes (champ "notes" du JSON). Voyons.
  const fullExpenses = await prisma.expense.findMany();
  const notesById = new Map<string, string>();
  for (const e of fullExpenses) {
    // Les références sont stockées dans le champ Expense.reference (pas mis à l'import)
    // ou dans Expense.description. Je cherche dans description.
    notesById.set(e.id, e.description ?? "");
  }

  const expenses: ExpenseLite[] = rawExpenses.map((e) => ({
    id: e.id,
    description: e.description,
    date: e.date,
    montantTTC: Number(e.montantTTC),
    reference: e.reference,
    notes: notesById.get(e.id) ?? "",
    ticketUrl: e.ticketUrl,
  }));

  console.log(
    `${expenses.length} charges en DB (${expenses.filter((e) => e.ticketUrl).length} déjà avec ticket).`,
  );

  // Liste les fichiers source
  const allFiles = await readdir(SOURCE_DIR);
  const fileEntries: string[] = [];
  for (const f of allFiles) {
    const s = await stat(join(SOURCE_DIR, f));
    if (s.isFile() && !/^~|^\.~/i.test(f)) fileEntries.push(f);
  }
  console.log(`${fileEntries.length} fichiers source.\n`);

  // Match
  const results: MatchResult[] = [];
  // On itère plusieurs passes : à chaque match high, on "consomme" l'Expense
  // (le ticketUrl bidon) pour qu'elle ne soit plus candidate aux suivants
  const consumed = new Set<string>();
  // 1ère passe : highs
  for (const fn of fileEntries) {
    const r = matchFile(
      fn,
      expenses.map((e) =>
        consumed.has(e.id) ? { ...e, ticketUrl: "consumed" } : e,
      ),
    );
    if (r.matched && r.confidence === "high") {
      consumed.add(r.matched.id);
    }
    results.push(r);
  }
  // 2e passe : pour les low, on re-tente en ayant consommé les highs
  for (let i = 0; i < results.length; i++) {
    if (results[i].confidence === "low" || results[i].confidence === "none") {
      const r = matchFile(
        results[i].fileName,
        expenses.map((e) =>
          consumed.has(e.id) ? { ...e, ticketUrl: "consumed" } : e,
        ),
      );
      if (r.matched) {
        consumed.add(r.matched.id);
        results[i] = r;
      }
    }
  }

  const matched = results.filter((r) => r.matched);
  const ambiguous = results.filter(
    (r) => !r.matched && r.confidence === "low",
  );
  const noMatch = results.filter(
    (r) => !r.matched && r.confidence === "none",
  );

  console.log("=".repeat(60));
  console.log(`✓ Matchés : ${matched.length}`);
  console.log(`⚠ Ambigus : ${ambiguous.length}`);
  console.log(`⊘ Sans match : ${noMatch.length}`);
  console.log("=".repeat(60));

  console.log("\n--- MATCHÉS ---");
  for (const r of matched) {
    console.log(
      `  ${r.fileName.padEnd(45)} → ${(r.matched!.description ?? "").padEnd(50)} ${r.matched!.montantTTC.toFixed(2)} CHF  [${r.confidence}/${r.reason}]`,
    );
  }
  if (ambiguous.length > 0) {
    console.log("\n--- AMBIGUS ---");
    for (const r of ambiguous) {
      console.log(`  ${r.fileName.padEnd(45)} → ${r.reason}`);
    }
  }
  if (noMatch.length > 0) {
    console.log("\n--- SANS MATCH ---");
    for (const r of noMatch) console.log(`  ${r.fileName}`);
  }

  if (!DRY) {
    console.log("\n>>> Application des matches...");
    let applied = 0;
    for (const r of matched) {
      const id = r.matched!.id;
      const dir = join(PUBLIC_EXPENSES_DIR, id);
      await mkdir(dir, { recursive: true });
      const target = join(dir, r.fileName);
      await copyFile(join(SOURCE_DIR, r.fileName), target);
      await prisma.expense.update({
        where: { id },
        data: {
          ticketUrl: `/expenses/${id}/${r.fileName}`,
          ticketName: r.fileName,
        },
      });
      applied++;
    }
    console.log(`✓ ${applied} tickets liés.`);
  } else {
    console.log("\n(DRY-RUN — relance avec --execute pour appliquer)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
