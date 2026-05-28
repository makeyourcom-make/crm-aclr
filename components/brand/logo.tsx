"use client";

/**
 * Composant Logo Make Your Com.
 *
 * Deux variantes :
 *   - "mark" : juste le monogramme M stylisé (carré, compact)
 *   - "full" : logo complet MAKE YOUR COM (horizontal)
 *
 * Les images vivent dans /public/brand/ :
 *   - m-monogram.png  → variante "mark"
 *   - logo-full.png   → variante "full"
 *
 * Si l'image n'existe pas (par ex. on n'a pas encore déposé les PNG),
 * on tombe sur un fallback CSS sobre — pas d'icône cassée.
 */
import { useState } from "react";

interface LogoProps {
  variant?: "mark" | "full";
  /** Taille en pixels (côté pour mark, hauteur pour full). */
  size?: number;
  className?: string;
}

export function Logo({ variant = "mark", size = 40, className }: LogoProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <Fallback variant={variant} size={size} className={className} />;
  }

  const src =
    variant === "mark" ? "/brand/m-monogram.png" : "/brand/logo-full.png";
  const width = variant === "mark" ? size : Math.round(size * 2.5);
  const height = size;

  // On utilise <img> natif et non next/image pour gérer le fallback côté client.
  // next/image lance une erreur runtime si le fichier manque ; <img> juste
  // un onError simple.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Make Your Com"
      width={width}
      height={height}
      onError={() => setErrored(true)}
      className={className}
      style={{
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}

/**
 * Fallback CSS — un M serif en navy si le PNG n'est pas trouvé.
 * Tu peux toujours déposer tes vrais logos dans /public/brand/ pour
 * remplacer ce rendu.
 */
function Fallback({
  variant,
  size,
  className,
}: {
  variant: "mark" | "full";
  size: number;
  className?: string;
}) {
  if (variant === "mark") {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-md bg-primary text-white ${className ?? ""}`}
        style={{
          width: size,
          height: size,
          fontFamily: '"Times New Roman", Georgia, serif',
          fontSize: Math.round(size * 0.62),
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
        aria-label="Make Your Com"
      >
        M
      </div>
    );
  }

  // Variante "full" : navy bandeau avec MAKE YOUR COM en serif + COM en coral
  return (
    <div
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 ${className ?? ""}`}
      style={{
        backgroundColor: "#0E1936",
        color: "#ffffff",
        fontFamily: '"Times New Roman", Georgia, serif',
        fontSize: Math.round(size * 0.5),
        fontWeight: 700,
        letterSpacing: "0.06em",
        lineHeight: 1,
        height: size,
      }}
      aria-label="Make Your Com"
    >
      MAKE YOUR <span style={{ color: "#F47174" }}>C</span>OM
    </div>
  );
}
