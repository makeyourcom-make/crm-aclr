"use client";

import { useEffect, useRef } from "react";

import { markProspectOpened } from "@/app/(app)/prospects/actions";

/**
 * Marque la fiche comme « ouverte » (NOUVEAU → VIERGE) au 1er montage réel de
 * la page détail. Rendu côté client via useEffect : ne se déclenche donc PAS
 * au prefetch/survol du lien, uniquement quand l'utilisateur ouvre vraiment la
 * fiche. Ne rend rien.
 */
export function MarkOpenedOnMount({ prospectId }: { prospectId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markProspectOpened(prospectId);
  }, [prospectId]);
  return null;
}
