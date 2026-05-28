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
 * Tant que les fichiers ne sont pas présents, on rend un fallback CSS
 * (carré navy ou bandeau coloré) pour éviter une image cassée.
 */
import Image from "next/image";

interface LogoProps {
  variant?: "mark" | "full";
  /** Taille en pixels (côté pour mark, hauteur pour full). */
  size?: number;
  className?: string;
}

export function Logo({ variant = "mark", size = 40, className }: LogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/m-monogram.png"
        alt="Make Your Com"
        width={size}
        height={size}
        priority
        className={className}
      />
    );
  }

  // Variante full : largeur proportionnelle, hauteur fixée
  return (
    <Image
      src="/brand/logo-full.png"
      alt="Make Your Com"
      width={size * 2.5}
      height={size}
      priority
      className={className}
    />
  );
}
