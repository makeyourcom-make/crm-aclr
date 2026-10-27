/**
 * Composant Logo Make Your Com.
 *
 * Variantes :
 *   - "full"     : wordmark horizontal image « MAKE YOUR COM » (/brand/wordmark.png)
 *   - "mark"     : logo carré navy (/brand/logo-full.png) pour les petits espaces
 *   - "wordmark" : logo officiel transparent, `tone="dark"` sur fond navy
 *                  (/brand/wordmark-on-dark.png, blanc + coral), `light` sinon
 *                  (/brand/wordmark-light.png).
 *
 * Les fichiers vivent dans /public/brand/. `size` = hauteur en pixels pour les
 * images (la largeur du wordmark image est calculée d'après son ratio réel
 * 707×266) et taille de police du wordmark texte.
 */
import Image from "next/image";

import { cn } from "@/lib/utils";

const WORDMARK_RATIO = 707 / 266; // ≈ 2.658
const LIGHT_RATIO = 627 / 214; // wordmark transparent (wordmark-light / wordmark-on-dark)

interface LogoProps {
  variant?: "mark" | "full" | "wordmark";
  /** Hauteur en pixels (images) ou taille de police (wordmark texte). */
  size?: number;
  className?: string;
  /** Wordmark texte : couleur du texte (dark = sur fond navy). */
  tone?: "light" | "dark";
  /** Sous-titre optionnel sous le logo (aucun par défaut). */
  tagline?: string | null;
}

export function Logo({
  variant = "mark",
  size = 40,
  className,
  tone = "light",
  tagline = null,
}: LogoProps) {
  if (variant === "wordmark") {
    // Logo officiel transparent : blanc + coral sur fond navy (dark),
    // navy + coral sur fond clair (light). `size` = hauteur en px.
    const src = tone === "dark" ? "/brand/wordmark-on-dark.png" : "/brand/wordmark-light.png";
    const width = Math.round(size * LIGHT_RATIO);
    return (
      <span className={cn("inline-flex flex-col gap-1", className)}>
        <Image
          src={src}
          alt="Make Your Com"
          width={width}
          height={size}
          style={{ height: size, width: "auto", display: "block" }}
          priority
        />
        {tagline && (
          <span
            className={cn(
              "text-[11px] font-bold tracking-[0.08em] uppercase",
              tone === "dark" ? "text-navy-300" : "text-muted-foreground",
            )}
          >
            {tagline}
          </span>
        )}
      </span>
    );
  }

  if (variant === "full") {
    const width = Math.round(size * WORDMARK_RATIO);
    return (
      <Image
        src="/brand/wordmark.png"
        alt="Make Your Com"
        width={width}
        height={size}
        className={className}
        style={{ height: size, width: "auto", display: "block" }}
        priority
      />
    );
  }

  // "mark" : logo carré (navy), net à toute taille.
  return (
    <Image
      src="/brand/logo-full.png"
      alt="Make Your Com"
      width={size}
      height={size}
      className={className}
      style={{ display: "block" }}
      priority
    />
  );
}
