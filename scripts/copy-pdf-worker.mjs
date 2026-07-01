/**
 * Copie le worker pdf.js depuis node_modules vers /public à chaque build,
 * pour le servir en local (même origine) plutôt que depuis un CDN externe
 * (bloqué par la CSP). Garde automatiquement la version alignée sur pdfjs-dist.
 * Guardé : n'échoue jamais le build si la source est absente.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const src = "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
const dest = "public/pdf.worker.min.mjs";

try {
  if (existsSync(src)) {
    if (!existsSync("public")) mkdirSync("public");
    copyFileSync(src, dest);
    console.log("[copy-pdf-worker] worker copié →", dest);
  } else {
    console.warn("[copy-pdf-worker] source absente, ignoré:", src);
  }
} catch (e) {
  console.warn("[copy-pdf-worker] échec (non bloquant):", e.message);
}
