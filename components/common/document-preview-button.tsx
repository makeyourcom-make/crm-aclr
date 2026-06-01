"use client";

/**
 * Bouton "Aperçu" qui ouvre un PDF ou une image dans une modal plein-écran,
 * sans téléchargement ni changement d'onglet.
 *
 * Usage :
 *   <DocumentPreviewButton url={url} filename="Facture XX.pdf" />
 *
 * - PDF → iframe natif du navigateur
 * - Image (jpg/png/webp/gif) → balise <img> avec zoom
 * - Bouton "Télécharger" + "Ouvrir dans un onglet" disponibles dans la modal
 * - Ferme avec Escape ou clic en dehors
 */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export interface DocumentPreviewButtonProps {
  url: string;
  filename?: string | null;
  /** Texte du bouton déclencheur. Défaut : "Voir". */
  label?: string;
  /** Icône Lucide. Défaut : "Eye". */
  icon?: string;
  /** Style du bouton déclencheur (override). */
  className?: string;
  /** Si false, n'affiche que l'icône (sans texte). */
  showLabel?: boolean;
}

export function DocumentPreviewButton({
  url,
  filename,
  label = "Voir",
  icon = "Eye",
  className,
  showLabel = true,
}: DocumentPreviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
  const displayName = filename ?? extractFilename(url) ?? "Document";

  // Ferme avec Escape + lock scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Fetch le PDF (ou autre) en blob pour le rendre via blob: URL.
  // Chrome refuse souvent les PDF en iframe sur URL distante (auth, sandbox)
  // mais accepte toujours les blob: URL same-origin.
  useEffect(() => {
    if (!open || isImage) return;
    let canceled = false;
    let currentBlobUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (canceled) return;
        currentBlobUrl = URL.createObjectURL(
          new Blob([blob], { type: "application/pdf" }),
        );
        setBlobUrl(currentBlobUrl);
      })
      .catch((e) => {
        if (canceled) return;
        setError(e?.message ?? "Erreur de chargement");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [open, url, isImage]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={displayName}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] hover:bg-muted",
          className,
        )}
      >
        <Icon name={icon} className="h-3 w-3" />
        {showLabel && label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex h-[92vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
              <div className="truncate text-sm font-medium" title={displayName}>
                {displayName}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] hover:bg-muted"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <Icon name="ExternalLink" className="h-3 w-3" />
                  Onglet
                </a>
                <a
                  href={url}
                  download={displayName}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] hover:bg-muted"
                  title="Télécharger"
                >
                  <Icon name="Download" className="h-3 w-3" />
                  Télécharger
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background hover:bg-muted"
                  title="Fermer (Échap)"
                  aria-label="Fermer"
                >
                  <Icon name="X" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-auto bg-muted/10">
              {isImage ? (
                <div className="flex h-full items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={displayName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <Icon
                      name="Loader"
                      className="mx-auto h-8 w-8 animate-spin text-muted-foreground"
                    />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Chargement du PDF…
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-rose-700">Erreur : {error}</p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                      Ouvrir dans un nouvel onglet
                    </a>
                  </div>
                </div>
              ) : blobUrl ? (
                <PdfRender url={blobUrl} fallbackHref={url} title={displayName} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Rendu PDF via react-pdf (PDF.js par Mozilla) — fonctionne dans tous les
 * navigateurs même quand le visualiseur PDF natif est désactivé.
 *
 * Charge dynamiquement react-pdf (lourd, ~500KB) uniquement quand on ouvre
 * la modal pour la 1ère fois.
 */
function PdfRender({
  url,
  fallbackHref,
  title,
}: {
  url: string;
  fallbackHref: string;
  title: string;
}) {
  const [Doc, setDoc] = useState<null | typeof import("react-pdf")>(null);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lazy load react-pdf + configure worker
  useEffect(() => {
    let canceled = false;
    import("react-pdf")
      .then((mod) => {
        if (canceled) return;
        // Worker via CDN unpkg (taille minime, déjà cache CDN)
        mod.pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`;
        setDoc(mod);
      })
      .catch((e) => {
        if (!canceled) setLoadError(e?.message ?? "Erreur chargement viewer");
      });
    return () => {
      canceled = true;
    };
  }, []);

  // Suit la largeur du conteneur pour rendre les pages à bonne échelle
  useEffect(() => {
    const update = () => {
      const w = Math.min(window.innerWidth * 0.85, 1100);
      setContainerWidth(w);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-rose-700">
            Impossible de charger le visualiseur : {loadError}
          </p>
          <a
            href={fallbackHref}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            Ouvrir dans un nouvel onglet
          </a>
        </div>
      </div>
    );
  }

  if (!Doc) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Icon
            name="Loader"
            className="mx-auto h-8 w-8 animate-spin text-muted-foreground"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Initialisation du visualiseur PDF…
          </p>
        </div>
      </div>
    );
  }

  const { Document: PdfDoc, Page: PdfPage } = Doc;
  return (
    <div className="relative flex h-full flex-col items-center overflow-auto bg-muted/30 p-4">
      <PdfDoc
        file={url}
        onLoadSuccess={({ numPages }: { numPages: number }) => setPageCount(numPages)}
        onLoadError={(e: Error) => setLoadError(e.message)}
        loading={
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Icon name="Loader" className="h-4 w-4 animate-spin" /> Chargement du PDF…
          </div>
        }
      >
        {Array.from({ length: pageCount }, (_, i) => (
          <div
            key={i}
            className="mb-6 overflow-hidden rounded shadow-lg ring-1 ring-black/10"
          >
            <div className="border-b border-border bg-white px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Page {i + 1} / {pageCount}
            </div>
            <PdfPage
              pageNumber={i + 1}
              width={containerWidth}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          </div>
        ))}
      </PdfDoc>
      {pageCount > 0 && (
        <div className="sticky bottom-2 rounded-full bg-black/80 px-3 py-1 text-xs font-medium text-white shadow-lg">
          {pageCount} page{pageCount > 1 ? "s" : ""} au total
        </div>
      )}
    </div>
  );
}

function extractFilename(url: string): string | null {
  try {
    const u = new URL(url, "https://placeholder.example");
    const last = u.pathname.split("/").filter(Boolean).pop() ?? null;
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}
