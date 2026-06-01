/**
 * Abstraction du stockage de fichiers (tickets, PJs, contrats signés, docs RH).
 *
 *  • STORAGE_MODE=local (dev sur disque local) → écrit dans /public/{prefix}/{filename},
 *    URL servie automatiquement par Next.js (statique).
 *  • STORAGE_MODE=blob (prod Vercel) → upload vers Vercel Blob,
 *    URL publique HTTPS retournée par Vercel.
 *
 * Cette abstraction permet de :
 *   - Garder le dev simple (fichiers visibles dans /public/)
 *   - Déployer en serverless (Vercel) où le filesystem est read-only en runtime
 *
 * Toutes les actions serveur qui manipulent des fichiers doivent passer par
 * cette API plutôt que d'utiliser fs/promises directement.
 */

type StorageMode = "local" | "blob";

function getStorageMode(): StorageMode {
  const m = process.env.STORAGE_MODE;
  if (m === "blob") return "blob";
  return "local";
}

export interface UploadOptions {
  /** Préfixe logique (ex: "expenses/{expenseId}", "rh/{userId}", "signed-contracts/{contractId}"). */
  prefix: string;
  /** Nom de fichier (sera nettoyé). */
  filename: string;
  /** Contenu binaire. */
  buffer: Buffer;
  /** Type MIME (ex: "image/jpeg", "application/pdf"). Optionnel mais recommandé. */
  contentType?: string;
}

export interface UploadResult {
  /** URL publique (locale: "/expenses/..." — Vercel Blob: "https://..."). */
  url: string;
  /** Taille en bytes. */
  size: number;
  /** Nom du fichier réellement stocké (peut différer de l'original). */
  storedName: string;
}

/**
 * Sanitize un nom de fichier pour éviter les caractères dangereux.
 * Conserve l'extension si elle existe.
 */
function sanitizeFilename(name: string): string {
  // Garde extension
  const dotIdx = name.lastIndexOf(".");
  const ext = dotIdx > 0 ? name.slice(dotIdx + 1).toLowerCase() : "";
  const base = (dotIdx > 0 ? name.slice(0, dotIdx) : name)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
  return ext ? `${base}.${ext}` : base;
}

/**
 * Upload un fichier vers le stockage approprié et renvoie son URL publique.
 */
export async function uploadFile(opts: UploadOptions): Promise<UploadResult> {
  const mode = getStorageMode();
  const safeName = sanitizeFilename(opts.filename);
  // Préfixe daté pour éviter les collisions (et permettre nom original lisible)
  const finalName = `${Date.now()}-${safeName}`;
  const key = `${opts.prefix.replace(/^\/+|\/+$/g, "")}/${finalName}`;

  if (mode === "blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, opts.buffer, {
      access: "public",
      contentType: opts.contentType,
      // Vercel Blob ajoute un suffixe random par défaut — on désactive pour garder le path stable
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return {
      url: blob.url,
      size: opts.buffer.length,
      storedName: finalName,
    };
  }

  // local
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "public", opts.prefix);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, finalName), opts.buffer);
  return {
    url: `/${opts.prefix.replace(/^\/+|\/+$/g, "")}/${finalName}`,
    size: opts.buffer.length,
    storedName: finalName,
  };
}

/**
 * Supprime un fichier précédemment uploadé. Idempotent (ignore les erreurs si
 * le fichier n'existe pas).
 *
 * @param url L'URL renvoyée par uploadFile (commence par "/" en local ou
 *            "https://" en blob).
 */
export async function deleteFile(url: string): Promise<void> {
  if (!url) return;
  const mode = getStorageMode();

  // Si l'URL ressemble à une URL Vercel Blob (https://...blob.vercel-storage.com)
  // on essaie de la supprimer côté Blob, même si STORAGE_MODE=local
  // (utile pour les migrations / fichiers existants).
  if (url.startsWith("https://") && url.includes("blob.vercel-storage.com")) {
    try {
      const { del } = await import("@vercel/blob");
      await del(url);
    } catch {
      // ignore
    }
    return;
  }

  if (mode === "local" && url.startsWith("/")) {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      await fs.unlink(path.join(process.cwd(), "public", url));
    } catch {
      // ignore (le fichier peut déjà avoir disparu)
    }
    return;
  }
}

/**
 * True si l'URL d'un fichier correspond à un fichier en blob storage
 * (utile pour décider si on doit servir un proxy ou rediriger).
 */
export function isBlobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith("https://") && url.includes("blob.vercel-storage.com")
  );
}
