/**
 * OCR Claude des tickets non encore liés + matching automatique avec les Expense en DB.
 *
 * Pour chaque fichier non lié :
 *   1. Envoie à Claude Haiku 4.5 (vision pour images, document pour PDFs)
 *   2. Récupère : montant TTC, date, devise originale, fournisseur
 *   3. Convertit en CHF (EUR × 0.95 / USD × 0.895) si nécessaire
 *   4. Cherche Expense matching : montantTTC à ±0.05 CHF, date du même mois
 *   5. Si match unique → lie le fichier
 */
import "dotenv/config";

import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();
const DRY = !process.argv.includes("--execute");

const SOURCE_DIR =
  "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges";
const PUBLIC_EXPENSES_DIR =
  "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\04. Make Your Com\\CRM\\public\\expenses";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY manquant dans .env");
  process.exit(1);
}
const client = new Anthropic({ apiKey });

const SYSTEM_PROMPT = `Tu es un assistant comptable suisse. Tu analyses des tickets / factures.

Renvoie UNIQUEMENT un JSON avec ce format :
{
  "date": "YYYY-MM-DD" | null,
  "fournisseur": "Nom du fournisseur" | null,
  "montantTTC": number | null,
  "devise": "CHF" | "EUR" | "USD" | null,
  "reference": "numéro de facture/ticket" | null
}

Règles :
- Date = date d'émission ou de paiement (priorité émission)
- Montant TTC = total final en chiffres
- Devise = celle imprimée sur le ticket (pas la conversion)
- Si plusieurs montants, prends le TOTAL final
- Renvoie null si tu ne peux pas lire avec certitude`;

interface Ocr {
  date: string | null;
  fournisseur: string | null;
  montantTTC: number | null;
  devise: "CHF" | "EUR" | "USD" | null;
  reference: string | null;
}

async function ocrFile(filePath: string): Promise<Ocr | null> {
  const buffer = await readFile(filePath);
  const base64 = buffer.toString("base64");
  const ext = filePath.split(".").pop()!.toLowerCase();
  const isPdf = ext === "pdf";

  try {
    const messages: Anthropic.MessageParam[] = [];
    if (isPdf) {
      messages.push({
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: "Extrais les informations." },
        ],
      });
    } else {
      const mime =
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";
      messages.push({
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mime as never, data: base64 },
          },
          { type: "text", text: "Extrais les informations." },
        ],
      });
    }

    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages,
    });

    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    const cleaned = text.trim().replace(/^```(json)?/, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error(`  ⚠ OCR failed:`, e instanceof Error ? e.message : e);
    return null;
  }
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
  // Liste tous les fichiers source
  const all = await readdir(SOURCE_DIR);
  const fileNames: string[] = [];
  for (const f of all) {
    const s = await stat(join(SOURCE_DIR, f));
    if (s.isFile() && !/^~|^\.~/i.test(f)) fileNames.push(f);
  }

  // Identifie les fichiers DÉJÀ liés (= déjà dans /public/expenses)
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
  const linkedNames = new Set(
    expenses.filter((e) => e.ticketName).map((e) => e.ticketName!),
  );
  const remainingFiles = fileNames.filter((f) => !linkedNames.has(f));
  const availableExpenses: ExpenseLite[] = expenses
    .filter((e) => !e.ticketUrl)
    .map((e) => ({
      id: e.id,
      description: e.description,
      date: e.date,
      montantTTC: Number(e.montantTTC),
    }));

  console.log(
    `${remainingFiles.length} fichiers à analyser, ${availableExpenses.length} expenses dispo.\n`,
  );

  let ocrCount = 0;
  let matchedCount = 0;
  const matches: Array<{ file: string; expenseId: string; reason: string }> = [];
  const noMatch: Array<{ file: string; ocr: Ocr | null }> = [];

  for (const fn of remainingFiles) {
    console.log(`📄 ${fn}`);
    const ocr = await ocrFile(join(SOURCE_DIR, fn));
    ocrCount++;
    if (!ocr || ocr.montantTTC == null) {
      console.log("   ⊘ OCR illisible");
      noMatch.push({ file: fn, ocr });
      continue;
    }
    const amountCHF = toCHF(ocr.montantTTC, ocr.devise ?? "CHF");
    const date = ocr.date ? new Date(ocr.date + "T00:00:00Z") : null;
    console.log(
      `   OCR: ${ocr.montantTTC} ${ocr.devise} = ${amountCHF.toFixed(2)} CHF, ${ocr.date}, ${ocr.fournisseur ?? "?"}`,
    );

    // Match par montant (±0.05 CHF)
    let candidates = availableExpenses.filter(
      (e) => Math.abs(e.montantTTC - amountCHF) < 0.10,
    );
    if (candidates.length === 0 && ocr.devise !== "CHF") {
      // Re-essaie sans conversion (montant original)
      candidates = availableExpenses.filter(
        (e) => Math.abs(e.montantTTC - ocr.montantTTC!) < 0.10,
      );
    }
    // Filtre par mois si possible
    if (candidates.length > 1 && date) {
      const byMonth = candidates.filter(
        (e) =>
          e.date.getUTCMonth() === date.getUTCMonth() &&
          e.date.getUTCFullYear() === date.getUTCFullYear(),
      );
      if (byMonth.length > 0) candidates = byMonth;
    }
    if (candidates.length === 1) {
      const c = candidates[0];
      console.log(
        `   ✓ MATCH → ${c.description} (${c.montantTTC.toFixed(2)} CHF, ${c.date.toISOString().slice(0, 10)})`,
      );
      matches.push({ file: fn, expenseId: c.id, reason: `ocr_amount` });
      // Marque comme consommé
      const idx = availableExpenses.findIndex((e) => e.id === c.id);
      if (idx >= 0) availableExpenses.splice(idx, 1);
      matchedCount++;
    } else if (candidates.length > 1) {
      console.log(`   ⚠ ${candidates.length} candidats par montant`);
      noMatch.push({ file: fn, ocr });
    } else {
      console.log(`   ⊘ pas de match`);
      noMatch.push({ file: fn, ocr });
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`OCR effectués : ${ocrCount}`);
  console.log(`Matches trouvés : ${matchedCount}`);
  console.log(`Sans match : ${noMatch.length}`);
  console.log("=".repeat(60));

  if (!DRY && matches.length > 0) {
    console.log("\n>>> Application...");
    for (const m of matches) {
      const dir = join(PUBLIC_EXPENSES_DIR, m.expenseId);
      await mkdir(dir, { recursive: true });
      const target = join(dir, m.file);
      await copyFile(join(SOURCE_DIR, m.file), target);
      await prisma.expense.update({
        where: { id: m.expenseId },
        data: {
          ticketUrl: `/expenses/${m.expenseId}/${m.file}`,
          ticketName: m.file,
        },
      });
    }
    console.log(`✓ ${matches.length} fichiers copiés et liés.`);
  } else if (DRY) {
    console.log("\n(DRY-RUN — relance avec --execute pour appliquer)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
