"use client";

/**
 * Aperçu du Google Doc de suivi + bouton « Actualiser ».
 *
 * L'iframe /preview affiche la dernière version enregistrée AU MOMENT DU
 * CHARGEMENT ; Google ne pousse pas les modifications en direct dans une
 * fenêtre intégrée. Le bouton recharge uniquement l'iframe (nouvelle clé React)
 * pour re-chercher la version courante sans recharger toute la page.
 */
import { useState } from "react";

import { Icon } from "@/components/icon";

export function DossierDocPreview({ previewUrl }: { previewUrl: string }) {
  const [key, setKey] = useState(0);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          Aperçu (lecture seule) — dernière version au chargement.
        </span>
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          <Icon name="RotateCcw" className="h-3.5 w-3.5" />
          Actualiser l&apos;aperçu
        </button>
      </div>
      <iframe
        key={key}
        src={previewUrl}
        title="Document de suivi des projets"
        className="h-[calc(100vh-22rem)] min-h-[30rem] w-full"
      />
    </div>
  );
}
