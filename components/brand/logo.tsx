/**
 * Composant Logo Make Your Com.
 *
 * Variantes :
 *   - "full"     : wordmark horizontal image « MAKE YOUR COM » (/brand/wordmark.png)
 *   - "mark"     : logo carré navy (/brand/logo-full.png) pour les petits espaces
 *   - "wordmark" : wordmark TEXTE MYC Arena (Bricolage 800, le « C » de COM en
 *                  coral) + sous-titre optionnel « Arena ». Net à toute taille,
 *                  `tone="dark"` sur fond navy (texte blanc), `light` sinon.
 *
 * Les fichiers vivent dans /public/brand/. `size` = hauteur en pixels pour les
 * images (la largeur du wordmark image est calculée d'après son ratio réel
 * 707×266) et taille de police du wordmark texte.
 */
import Image from "next/image";

import { cn } from "@/lib/utils";

const WORDMARK_RATIO = 707 / 266; // ≈ 2.658

interface LogoProps {
  variant?: "mark" | "full" | "wordmark";
  /** Hauteur en pixels (images) ou taille de police (wordmark texte). */
  size?: number;
  className?: string;
  /** Wordmark texte : couleur du texte (dark = sur fond navy). */
  tone?: "light" | "dark";
  /** Wordmark texte : sous-titre (« Arena » par défaut, null pour masquer). */
  tagline?: string | null;
}

export function Logo({
  variant = "mark",
  size = 40,
  className,
  tone = "light",
  tagline = "Arena",
}: LogoProps) {
  if (variant === "wordmark") {
    return (
      <span className={cn("inline-flex flex-col gap-1", className)}>
        <span
          className={cn(
            "font-display leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap",
            tone === "dark" ? "text-white" : "text-navy-700",
          )}
          style={{ fontSize: size }}
        >
          MAKE YOUR{" "}
          <span className={tone === "dark" ? "text-coral-400" : "text-coral-600"}>
            C
          </span>
          OM
        </span>
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
