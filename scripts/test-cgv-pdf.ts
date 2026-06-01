/**
 * Génère un PDF de test avec uniquement les CGV pour valider le rendu
 * et compter le nombre de pages.
 */
import { Document, renderToFile } from "@react-pdf/renderer";
import { writeFileSync } from "node:fs";
import React from "react";

import { CgvPages } from "@/lib/pdf/cgv-pages";
import { CGV_ARTICLES } from "@/lib/cgv";

async function main() {
  console.log(`CGV en mémoire :`);
  console.log(`  • ${CGV_ARTICLES.length} articles`);
  let totalParagraphs = 0;
  for (const a of CGV_ARTICLES) {
    console.log(
      `    ${a.number}. ${a.title.slice(0, 60).padEnd(62)} (${a.paragraphs.length} para.)`,
    );
    totalParagraphs += a.paragraphs.length;
  }
  console.log(`  • ${totalParagraphs} paragraphes au total\n`);

  console.log("Génération PDF test...");
  const outPath = String.raw`C:\Users\Admin\Desktop\HOME\10. M A K E\04. Make Your Com\CRM\cgv-test.pdf`;
  await renderToFile(
    React.createElement(Document, { title: "CGV test" }, React.createElement(CgvPages)),
    outPath,
  );
  console.log(`✓ PDF généré : ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
