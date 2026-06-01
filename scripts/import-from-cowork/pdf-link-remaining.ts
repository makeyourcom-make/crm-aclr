/**
 * Match les PDFs non liés par extraction texte (pdftotext) → DB.
 *
 * Pour chaque PDF :
 *   1. Extrait le texte via pdftotext
 *   2. Cherche dans le texte : montant CHF/EUR/USD, date, référence
 *   3. Match avec la DB par montant exact (±0.10 CHF)
 *   4. Si match unique → lie le fichier
 *
 * Les images (jpg/jpeg/png) sont skip (à traiter via OCR ou à la main).
 */
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();
const DRY = !process.argv.includes("--execute");

const SOURCE_DIR =
  "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges";
const PUBLIC_EXPENSES_DIR =
  "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\04. Make Your Com\\CRM\\public\\expenses";
const PDFTOTEXT = "C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe";

function pdfText(filePath: string): string {
  try {
    const buf = execFileSync(PDFTOTEXT, ["-enc", "UTF-8", filePath, "-"], {
      encoding: "utf8",
      timeout: 10000,
    });
    return buf;
  } catch {
    return "";
  }
}

interface ExtractedInfo {
  amounts: number[];
  dates: string[];
  refs: string[];
  currency: "CHF" | "EUR" | "USD" | "?";
}

function extractInfo(text: string): ExtractedInfo {
  // Devise
  let currency: ExtractedInfo["currency"] = "?";
  if (/CHF|fr\.|francs?\s+suisses?/i.test(text)) currency = "CHF";
  else if (/EUR|€|euros?/i.test(text)) currency = "EUR";
  else if (/USD|\$|US Dollars?/i.test(text)) currency = "USD";

  // Montants (chiffres avec point/virgule décimale + 2 décimales)
  const amounts: number[] = [];
  const amountMatches = text.matchAll(/(\d{1,5}(?:[.,\s]\d{3})*[.,]\d{2})\b/g);
  for (const m of amountMatches) {
    const cleaned = m[1].replace(/[\s']/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0.5 && num < 50000) {
      amounts.push(num);
    }
  }

  // Dates (formats divers)
  const dates: string[] = [];
  const datePatterns = [
    /(\d{4})-(\d{2})-(\d{2})/g, // ISO
    /(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/g, // DD/MM/YYYY
  ];
  for (const p of datePatterns) {
    for (const m of text.matchAll(p)) {
      if (m[0].startsWith("20")) {
        dates.push(m[0]);
      } else {
        const d = m[1].padStart(2, "0");
        const mo = m[2].padStart(2, "0");
        let y = m[3];
        if (y.length === 2) y = "20" + y;
        dates.push(`${y}-${mo}-${d}`);
      }
    }
  }

  // Références
  const refs: string[] = [];
  for (const m of text.matchAll(/\b(?:FC[-_]?\d{6,8}|GJYLUZ[-_]?\d{4,6}|JWBLWCBD[-_]?\d{4}|GCFRD\d{8,})\b/gi)) {
    refs.push(m[0].toUpperCase());
  }

  return { amounts, dates, refs, currency };
}

function toCHF(amount: number, devise: string): number {
  if (devise === "EUR") return amount * 0.95;
  if (devise === "USD") return amount * 0.895;
  return amount;
}

interface ExpenseLite {
  id: string;
  description: string | null;
  date: Date;
  montantTTC: number;
}

async function main() {
  const all = await readdir(SOURCE_DIR);
  const pdfs: string[] = [];
  for (const f of all) {
    if (!/\.pdf$/i.test(f)) continue;
    const s = await stat(join(SOURCE_DIR, f));
    if (s.isFile() && !/^~|^\.~/i.test(f)) pdfs.push(f);
  }

  const expenses = await prisma.expense.findMany({
    select: {
      id: true,
      description: true,
      date: true,
      montantTTC: true,
      ticketUrl: true,
      ticketName: true,
    },
  });
  const linked = new Set(
    expenses.filter((e) => e.ticketName).map((e) => e.ticketName!),
  );
  const remaining = pdfs.filter((f) => !linked.has(f));
  const available: ExpenseLite[] = expenses
    .filter((e) => !e.ticketUrl)
    .map((e) => ({
      id: e.id,
      description: e.description,
      date: e.date,
      montantTTC: Number(e.montantTTC),
    }));

  console.log(
    `${remaining.length} PDFs à analyser, ${available.length} expenses dispo.\n`,
  );

  const matches: Array<{ file: string; expenseId: string; reason: string }> = [];

  for (const fn of remaining) {
    const text = pdfText(join(SOURCE_DIR, fn));
    if (!text) {
      console.log(`📄 ${fn} → pas de texte extractible`);
      continue;
    }
    const info = extractInfo(text);
    console.log(
      `📄 ${fn.padEnd(40)} ${info.currency} amounts=${info.amounts.slice(0, 3).join(",")} refs=${info.refs.join(",")}`,
    );

    // Tente match
    let candidates = available;

    // Priorité 1 : recherche du plus gros montant compatible CHF
    if (info.amounts.length > 0) {
      const sorted = [...info.amounts].sort((a, b) => b - a); // décroissant
      let found = false;
      for (const amt of sorted) {
        const amtCHF = toCHF(amt, info.currency === "?" ? "CHF" : info.currency);
        const exact = available.filter(
          (e) => Math.abs(e.montantTTC - amtCHF) < 0.10,
        );
        if (exact.length >= 1) {
          candidates = exact;
          found = true;
          break;
        }
        // Re-essaie avec autre devise si "?"
        if (info.currency === "?") {
          const altEUR = available.filter(
            (e) => Math.abs(e.montantTTC - amt * 0.95) < 0.10,
          );
          if (altEUR.length >= 1) {
            candidates = altEUR;
            found = true;
            break;
          }
          const altUSD = available.filter(
            (e) => Math.abs(e.montantTTC - amt * 0.895) < 0.10,
          );
          if (altUSD.length >= 1) {
            candidates = altUSD;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        console.log("   ⊘ aucun montant ne matche");
        continue;
      }
    }

    // Filtre par date si plusieurs candidats
    if (candidates.length > 1 && info.dates.length > 0) {
      for (const dStr of info.dates) {
        const d = new Date(dStr + "T00:00:00Z");
        const byMonth = candidates.filter(
          (e) =>
            e.date.getUTCMonth() === d.getUTCMonth() &&
            e.date.getUTCFullYear() === d.getUTCFullYear(),
        );
        if (byMonth.length >= 1) {
          candidates = byMonth;
          break;
        }
      }
    }

    if (candidates.length === 1) {
      console.log(
        `   ✓ MATCH → ${candidates[0].description} (${candidates[0].montantTTC.toFixed(2)} CHF)`,
      );
      matches.push({
        file: fn,
        expenseId: candidates[0].id,
        reason: "pdftotext_amount",
      });
      const idx = available.findIndex((e) => e.id === candidates[0].id);
      if (idx >= 0) available.splice(idx, 1);
    } else if (candidates.length > 1) {
      console.log(
        `   ⚠ ${candidates.length} candidats: ${candidates.slice(0, 3).map((c) => (c.description ?? "").slice(0, 30) + " " + c.montantTTC.toFixed(2)).join(" / ")}`,
      );
    } else {
      console.log("   ⊘ aucun match");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Matches : ${matches.length}/${remaining.length}`);
  console.log("=".repeat(60));

  if (!DRY && matches.length > 0) {
    console.log("\n>>> Application...");
    for (const m of matches) {
      const dir = join(PUBLIC_EXPENSES_DIR, m.expenseId);
      await mkdir(dir, { recursive: true });
      await copyFile(join(SOURCE_DIR, m.file), join(dir, m.file));
      await prisma.expense.update({
        where: { id: m.expenseId },
        data: {
          ticketUrl: `/expenses/${m.expenseId}/${m.file}`,
          ticketName: m.file,
        },
      });
    }
    console.log(`✓ ${matches.length} liés.`);
  } else if (DRY) {
    console.log("\n(DRY-RUN — relance avec --execute)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
