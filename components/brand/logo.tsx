/**
 * Composant Logo Make Your Com — utilise les vraies images de marque.
 *
 * Variantes :
 *   - "full" : wordmark horizontal « MAKE YOUR COM » (/brand/wordmark.png)
 *   - "mark" : logo carré navy (/brand/logo-full.png) pour les petits espaces
 *
 * Les fichiers vivent dans /public/brand/. `size` = hauteur en pixels ;
 * la largeur du wordmark est calculée d'après son ratio réel (707×266).
 */
import Image from "next/image";

const WORDMARK_RATIO = 707 / 266; // ≈ 2.658

interface LogoProps {
  variant?: "mark" | "full";
  /** Hauteur en pixels (côté pour "mark", hauteur pour "full"). */
  size?: number;
  className?: string;
}

export function Logo({ variant = "mark", size = 40, className }: LogoProps) {
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

  // "mark" : logo carré (navy) — net à toute taille.
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
