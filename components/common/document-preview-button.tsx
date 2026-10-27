"use client";

/**
 * Bouton "Aperçu" qui ouvre un PDF ou une image dans une modal plein-écran,
 * sans téléchargement ni changement d'onglet.
 *
 * Usage :
 *   <DocumentPreviewButton url={url} filename="Facture XX.pdf" />
 *
 * - PDF → rendu PDF.js (react-pdf), chargé à la demande
 * - Image (jpg/png/webp/gif) → balise <img>
 * - Boutons "Onglet" + "Télécharger" dans la barre de la modal
 * - Ferme avec Échap ou clic en dehors
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

const TOOLBAR_BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground transition-colors hover:bg-navy-50";

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

  const openPreview = () => {
    // Réinitialise l'état de chargement AU CLIC (et non dans l'effet) :
    // l'effet ne fait plus que lancer le téléchargement.
    if (!isImage) {
      setLoading(true);
      setError(null);
      setBlobUrl(null);
    }
    setOpen(true);
  };

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
          openPreview();
        }}
        title={displayName}
        aria-label={showLabel ? undefined : `${label} : ${displayName}`}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground transition-colors hover:bg-navy-50",
          className,
        )}
      >
        <Icon name={icon} className="size-3.5" aria-hidden="true" />
        {showLabel && label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-700/70 p-3 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Aperçu : ${displayName}`}
            className="relative flex h-[92vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-[20px] bg-card shadow-arena-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barre d'outils */}
            <div className="flex items-center justify-between gap-2 border-b border-border bg-ground px-3 py-2.5">
              <div
                className="min-w-0 truncate text-sm font-bold text-foreground"
                title={displayName}
              >
                {displayName}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className={TOOLBAR_BTN}
                  title="Ouvrir dans un nouvel onglet"
                >
                  <Icon name="ExternalLink" className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Onglet</span>
                  <span className="sr-only sm:hidden">Ouvrir dans un onglet</span>
                </a>
                <a
                  href={url}
                  download={displayName}
                  className={TOOLBAR_BTN}
                  title="Télécharger"
                >
                  <Icon name="Download" className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Télécharger</span>
                  <span className="sr-only sm:hidden">Télécharger</span>
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex size-9 items-center justify-center rounded-[10px] border border-border-strong bg-card text-foreground transition-colors hover:bg-navy-50"
                  title="Fermer (Échap)"
                  aria-label="Fermer l'aperçu"
                >
                  <Icon name="X" className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-auto bg-ground">
              {isImage ? (
                <div className="flex h-full items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={displayName}
                    className="max-h-full max-w-full rounded-[12px] object-contain"
                  />
                </div>
              ) : loading ? (
                <PreviewStatus>Chargement du PDF…</PreviewStatus>
              ) : error ? (
                <div className="flex h-full items-center justify-center p-6">
                  <div className="text-center">
                    <p className="text-sm font-bold text-alert-700">
                      Erreur : {error}
                    </p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm font-bold text-info-700 hover:underline"
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

function PreviewStatus({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center" role="status">
      <div className="text-center">
        <Icon
          name="Loader"
          className="mx-auto size-8 animate-spin text-subtle"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm font-medium text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

/**
 * Rendu PDF via react-pdf (PDF.js par Mozilla) : fonctionne dans tous les
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
  // Rendu uniquement côté client (après un clic) : window est disponible.
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== "undefined" ? Math.min(window.innerWidth * 0.85, 1100) : 800,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lazy load react-pdf + configure worker
  useEffect(() => {
    let canceled = false;
    import("react-pdf")
      .then((mod) => {
        if (canceled) return;
        // Worker servi en LOCAL (même origine) : compatible CSP 'self', pas de
        // dépendance CDN. Copié dans /public par scripts/copy-pdf-worker.mjs
        // (prebuild), version alignée sur pdfjs-dist.
        mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        setDoc(mod);
      })
      .catch((e) => {
        if (!canceled) setLoadError(e?.message ?? "Erreur chargement viewer");
      });
    return () => {
      canceled = true;
    };
  }, []);

  // Suit la largeur de la fenêtre pour rendre les pages à bonne échelle
  useEffect(() => {
    const update = () => {
      setContainerWidth(Math.min(window.innerWidth * 0.85, 1100));
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm font-bold text-alert-700">
            Impossible de charger le visualiseur : {loadError}
          </p>
          <a
            href={fallbackHref}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm font-bold text-info-700 hover:underline"
          >
            Ouvrir dans un nouvel onglet
          </a>
        </div>
      </div>
    );
  }

  if (!Doc) {
    return <PreviewStatus>Initialisation du visualiseur PDF…</PreviewStatus>;
  }

  const { Document: PdfDoc, Page: PdfPage } = Doc;
  return (
    <div
      aria-label={title}
      className="relative flex h-full flex-col items-center overflow-auto p-4"
    >
      <PdfDoc
        file={url}
        onLoadSuccess={({ numPages }: { numPages: number }) => setPageCount(numPages)}
        onLoadError={(e: Error) => setLoadError(e.message)}
        loading={
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Icon name="Loader" className="size-4 animate-spin" aria-hidden="true" />
            Chargement du PDF…
          </div>
        }
      >
        {Array.from({ length: pageCount }, (_, i) => (
          <div
            key={i}
            className="mb-6 overflow-hidden rounded-[12px] border border-border bg-card shadow-arena"
          >
            <div className="border-b border-border bg-card px-3 py-1.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
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
        <div className="sticky bottom-2 rounded-full bg-navy-700 px-3 py-1 text-xs font-bold text-white shadow-arena-lg">
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
