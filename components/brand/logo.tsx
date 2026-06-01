/**
 * Composant Logo Make Your Com — rendu 100 % CSS, sans dépendance image.
 *
 * Deux variantes :
 *   - "mark" : monogramme "M" serif sur fond navy (carré compact)
 *   - "full" : bandeau navy "MAKE YOUR COM" avec le C en coral
 *
 * Pourquoi pas <Image> ou <img> ?
 *   On a déjà tenté de charger des PNG depuis /public/brand/ — si le fichier
 *   n'existe pas (cas courant tant qu'on n'a pas déposé les exports), on a
 *   un icône cassée qui flashe avant le fallback. En rendant directement le
 *   CSS, on garantit que ça marche partout, immédiatement, sans 404.
 *
 * Si tu veux brancher de vraies images PNG plus tard, passe `useImage`
 * et place tes fichiers dans /public/brand/.
 */
import Image from "next/image";

interface LogoProps {
  variant?: "mark" | "full";
  /** Taille en pixels (côté pour mark, hauteur pour full). */
  size?: number;
  className?: string;
  /** Si true, utilise un PNG depuis /public/brand/. */
  useImage?: boolean;
}

export function Logo({
  variant = "mark",
  size = 40,
  className,
  useImage = false,
}: LogoProps) {
  if (useImage) {
    const src =
      variant === "mark" ? "/brand/m-monogram.png" : "/brand/logo-full.png";
    const width = variant === "mark" ? size : Math.round(size * 2.5);
    return (
      <Image
        src={src}
        alt="Make Your Com"
        width={width}
        height={size}
        className={className}
        style={{ objectFit: "contain", display: "block" }}
        priority
      />
    );
  }

  if (variant === "mark") {
    return (
      <div
        className={`inline-flex shrink-0 select-none items-center justify-center rounded-md shadow-sm ${className ?? ""}`}
        style={{
          width: size,
          height: size,
          backgroundColor: "#0E1936",
          color: "#ffffff",
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

  // Variante "full" : bandeau navy avec MAKE YOUR COM (C en coral)
  return (
    <div
      className={`inline-flex select-none items-center justify-center rounded-md ${className ?? ""}`}
      style={{
        backgroundColor: "#0E1936",
        color: "#ffffff",
        fontFamily: '"Times New Roman", Georgia, serif',
        fontSize: Math.round(size * 0.5),
        fontWeight: 700,
        letterSpacing: "0.06em",
        lineHeight: 1,
        height: size,
        padding: `0 ${Math.round(size * 0.4)}px`,
        whiteSpace: "nowrap",
      }}
      aria-label="Make Your Com"
    >
      MAKE&nbsp;YOUR&nbsp;<span style={{ color: "#F47174" }}>C</span>OM
    </div>
  );
}
