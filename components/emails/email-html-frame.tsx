"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Corps HTML d'un email, isolé dans une iframe dont la HAUTEUR SUIT LE CONTENU.
 *
 * Pourquoi pas une hauteur fixe : avec une iframe figée (600/700px), un mail
 * long doit être scrollé À L'INTÉRIEUR de l'iframe. Sous Windows la barre de
 * défilement interne est quasi invisible et la molette ne la vise pas toujours
 * → l'utilisateur a l'impression de ne pas pouvoir descendre dans le mail
 * (signalé par Arthur le 22.07.2026). En dimensionnant l'iframe à son contenu,
 * le mail s'inscrit dans le flux et une SEULE barre de défilement (celle de la
 * page ou du fil de discussion) suffit — comportement de Gmail.
 *
 * Sécurité : `allow-same-origin` sert UNIQUEMENT à lire la hauteur du document
 * depuis le parent. `allow-scripts` reste ABSENT — aucun script contenu dans un
 * mail ne s'exécute, donc l'isolation qui compte est préservée.
 */
export function EmailHtmlFrame({
  html,
  title,
  className,
}: {
  html: string;
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;

    const measure = () => {
      const doc = el.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(
        doc.body.scrollHeight,
        doc.documentElement?.scrollHeight ?? 0,
      );
      // +16 : évite de rogner la dernière ligne. La borne haute est un simple
      // garde-fou contre un contenu aberrant, très au-delà d'un mail réel.
      setHeight(Math.min(Math.max(h + 16, 120), 20000));
    };

    const onLoad = () => {
      measure();
      // Les images se chargent APRÈS le load et rallongent le document.
      const doc = el.contentDocument;
      if (doc?.body && typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(measure);
        ro.observe(doc.body);
      }
    };

    el.addEventListener("load", onLoad);
    // srcDoc peut déjà être rendu quand l'effet s'exécute.
    if (el.contentDocument?.readyState === "complete") onLoad();
    return () => {
      el.removeEventListener("load", onLoad);
      ro?.disconnect();
    };
  }, [html]);

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ height }}
      className={className ?? "w-full rounded border border-border bg-white"}
      title={title}
    />
  );
}
