/**
 * Migre tous les fichiers locaux (/public/expenses, /public/rh,
 * /public/signed-contracts) vers Vercel Blob et met à jour les URLs en DB.
 *
 * Prérequis :
 *   1. Avoir créé un Blob store sur Vercel (Vercel Dashboard → Storage → Blob)
 *   2. Avoir mis BLOB_READ_WRITE_TOKEN dans le .env local
 *   3. Avoir mis STORAGE_MODE="blob" dans le .env local (pour ce run)
 *
 * Lancement :
 *   STORAGE_MODE=blob npx tsx scripts/migrate-files-to-blob.ts
 *
 * Idempotence : on saute les fichiers dont l'URL est déjà sur Vercel Blob.
 */
import { PrismaClient } from "@prisma/client";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { uploadFile } from "@/lib/file-storage";

const prisma = new PrismaClient();
const PUBLIC_DIR = join(process.cwd(), "public");

function isLocalUrl(url: string | null): url is string {
  return !!url && url.startsWith("/") && !url.startsWith("//");
}

async function migrateFile(
  localUrl: string,
  prefix: string,
  fallbackContentType?: string,
): Promise<string | null> {
  const fullPath = join(PUBLIC_DIR, localUrl);
  try {
    await stat(fullPath);
  } catch {
    console.log(`  ⊘ Fichier introuvable : ${localUrl}`);
    return null;
  }
  const buf = await readFile(fullPath);
  // Devine content type depuis extension
  const ext = localUrl.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "pdf"
      ? "application/pdf"
      : ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : fallbackContentType;

  const filename = localUrl.split("/").pop() ?? "file";
  const upload = await uploadFile({
    prefix,
    filename,
    buffer: buf,
    contentType,
  });
  return upload.url;
}

async function main() {
  if (process.env.STORAGE_MODE !== "blob") {
    console.error(
      "❌ STORAGE_MODE doit être 'blob' pour ce script. Sinon les fichiers seraient juste recopiés localement.",
    );
    console.error("   Lance avec : STORAGE_MODE=blob npx tsx scripts/migrate-files-to-blob.ts");
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("❌ BLOB_READ_WRITE_TOKEN absent du .env.");
    process.exit(1);
  }

  console.log("=== Migration des fichiers vers Vercel Blob ===\n");

  // 1. Charges — ticketUrl
  console.log("📁 Charges (ticketUrl)");
  const charges = await prisma.expense.findMany({
    where: { ticketUrl: { not: null } },
    select: { id: true, ticketUrl: true },
  });
  let cMig = 0, cSkip = 0;
  for (const c of charges) {
    if (!isLocalUrl(c.ticketUrl)) {
      cSkip++;
      continue;
    }
    const newUrl = await migrateFile(c.ticketUrl, `expenses/${c.id}`);
    if (newUrl) {
      await prisma.expense.update({
        where: { id: c.id },
        data: { ticketUrl: newUrl },
      });
      cMig++;
      console.log(`  ✓ ${c.ticketUrl} → ${newUrl}`);
    }
  }
  console.log(`  → ${cMig} migrés, ${cSkip} déjà blob.\n`);

  // 2. Charges — attachments
  console.log("📁 Charges (pièces jointes)");
  const attachments = await prisma.expenseAttachment.findMany({
    select: { id: true, fileUrl: true, expenseId: true },
  });
  let aMig = 0, aSkip = 0;
  for (const a of attachments) {
    if (!isLocalUrl(a.fileUrl)) {
      aSkip++;
      continue;
    }
    const newUrl = await migrateFile(a.fileUrl, `expenses/${a.expenseId}`);
    if (newUrl) {
      await prisma.expenseAttachment.update({
        where: { id: a.id },
        data: { fileUrl: newUrl },
      });
      aMig++;
      console.log(`  ✓ ${a.fileUrl}`);
    }
  }
  console.log(`  → ${aMig} migrés, ${aSkip} déjà blob.\n`);

  // 3. Documents RH
  console.log("📁 Documents RH");
  const docs = await prisma.employeeDocument.findMany({
    select: { id: true, fileUrl: true, userId: true },
  });
  let dMig = 0, dSkip = 0;
  for (const d of docs) {
    if (!isLocalUrl(d.fileUrl)) {
      dSkip++;
      continue;
    }
    const newUrl = await migrateFile(d.fileUrl, `rh/${d.userId}`);
    if (newUrl) {
      await prisma.employeeDocument.update({
        where: { id: d.id },
        data: { fileUrl: newUrl },
      });
      dMig++;
      console.log(`  ✓ ${d.fileUrl}`);
    }
  }
  console.log(`  → ${dMig} migrés, ${dSkip} déjà blob.\n`);

  // 4. Contrats signés (documentSigneUrl dans Signature)
  console.log("📁 Signatures (contrats signés)");
  const sigs = await prisma.signature.findMany({
    where: { documentSigneUrl: { not: null } },
    select: { id: true, documentSigneUrl: true, contractId: true },
  });
  let sMig = 0, sSkip = 0;
  for (const s of sigs) {
    if (!isLocalUrl(s.documentSigneUrl)) {
      sSkip++;
      continue;
    }
    const newUrl = await migrateFile(
      s.documentSigneUrl,
      `signed-contracts/${s.contractId}`,
      "application/pdf",
    );
    if (newUrl) {
      await prisma.signature.update({
        where: { id: s.id },
        data: { documentSigneUrl: newUrl },
      });
      sMig++;
      console.log(`  ✓ ${s.documentSigneUrl}`);
    }
  }
  console.log(`  → ${sMig} migrés, ${sSkip} déjà blob.\n`);

  const total = cMig + aMig + dMig + sMig;
  console.log(`✓ Migration terminée : ${total} fichiers transférés sur Vercel Blob.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
