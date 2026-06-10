/**
 * Résolution des assets de marque (logo, bannière) pour les PDF @react-pdf.
 *
 * Pourquoi des data URL base64 et pas un chemin disque ?
 *   Sur Windows (dev), @react-pdf interprète un chemin absolu `C:\...` comme
 *   une URL au schéma `c:` et ignore silencieusement l'image. Le data URL
 *   base64 marche de façon identique en dev (Windows) et en prod (Linux).
 *
 * Mutualisé par : contrat (app/api/contrats/[id]/pdf) et factures client
 * (lib/pdf/build-client-invoice-pdf + app/api/factures-clients/[id]/pdf).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Largeur d'une page A4 en points (cohérent avec les templates PDF). */
export const A4_WIDTH_PT = 595.28;

function brandPath(...names: string[]): string[] {
  return names.map((n) => join(process.cwd(), "public", "brand", n));
}

/** Lit largeur/hauteur dans l'en-tête d'un PNG (IHDR, octets 16–23). */
function readPngSize(buf: Buffer): { width: number; height: number } | null {
  const PNG_SIG = "89504e470d0a1a0a";
  if (buf.length < 24 || buf.subarray(0, 8).toString("hex") !== PNG_SIG) {
    return null;
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Logo carré Make Your Com en data URL base64, ou undefined si absent. */
export function resolveLogoDataUrl(): string | undefined {
  for (const p of brandPath("logo-full.png", "logo.png")) {
    if (existsSync(p)) {
      return `data:image/png;base64,${readFileSync(p).toString("base64")}`;
    }
  }
  return undefined;
}

/**
 * Bannière pleine largeur : data URL base64 + hauteur (pt) calculée pour
 * occuper toute la largeur A4 sans déformation. Undefined si absente.
 */
export function resolveBanner():
  | { dataUrl: string; heightPt: number }
  | undefined {
  for (const p of brandPath("banner.png", "banniere.png")) {
    if (existsSync(p)) {
      const buf = readFileSync(p);
      const size = readPngSize(buf);
      const heightPt = size
        ? Math.round((A4_WIDTH_PT * size.height) / size.width)
        : 120; // repli si dimensions illisibles
      return {
        dataUrl: `data:image/png;base64,${buf.toString("base64")}`,
        heightPt,
      };
    }
  }
  return undefined;
}
