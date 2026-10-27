"use client";

/**
 * Aperçu du Google Doc de suivi + bouton « Actualiser » (MYC Arena).
 *
 * L'iframe /preview affiche la dernière version enregistrée AU MOMENT DU
 * CHARGEMENT ; Google ne pousse pas les modifications en direct dans une
 * fenêtre intégrée. Le bouton recharge uniquement l'iframe (nouvelle clé React)
 * pour re-chercher la version courante sans recharger toute la page.
 */
import { Eye, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DossierDocPreview({ previewUrl }: { previewUrl: string }) {
  const [key, setKey] = useState(0);

  return (
    <section
      aria-label="Aperçu du document de suivi"
      className="overflow-hidden rounded-[20px] border border-border bg-card shadow-arena"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-ground px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Eye aria-hidden="true" className="size-4" />
          Aperçu (lecture seule) · dernière version au chargement.
        </span>
        <Button variant="outline" size="sm" onClick={() => setKey((k) => k + 1)}>
          <RotateCcw aria-hidden="true" />
          Actualiser l&apos;aperçu
        </Button>
      </div>
      <iframe
        key={key}
        src={previewUrl}
        title="Document de suivi des projets"
        className="h-[calc(100dvh-22rem)] min-h-[30rem] w-full"
      />
    </section>
  );
}
