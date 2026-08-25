"use client";

import { Icon } from "@/components/icon";

/**
 * Composant client : le `onClick` (stopPropagation, pour ne pas déclencher le
 * clic de la carte parente) impose une frontière client. Sans « use client »,
 * rendu depuis un Server Component (ex. la timeline de la fiche prospect), Next
 * plantait avec « Event handlers cannot be passed to Client Component props ».
 *
 * Affiche un "lieu" de RDV cliquable. Selon le contenu :
 *  - URL (http(s)://) → icône Video, ouvre le lien (Meet/Zoom/Teams)
 *  - Numéro de téléphone (+, espaces, chiffres) → icône Phone, tel:
 *  - Sinon (texte/adresse) → icône MapPin, Google Maps
 */
export function AdresseRdvLink({
  adresse,
  size = "sm",
}: {
  adresse: string;
  /** sm = compact (agenda), md = lisible (timeline / détail) */
  size?: "sm" | "md";
}) {
  const trimmed = adresse.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);
  // Numéro de téléphone : commence par + ou un chiffre, ne contient que
  // chiffres / espaces / parenthèses / tirets / points (et 6 chiffres min)
  const isPhone =
    !isUrl &&
    /^[+\d][\d\s().-]{5,}$/.test(trimmed) &&
    (trimmed.match(/\d/g)?.length ?? 0) >= 6;

  let href: string;
  let iconName: string;
  let title: string;
  let label = trimmed;
  if (isUrl) {
    href = trimmed;
    iconName = "Video";
    title = "Ouvrir le lien visio";
    // Sur les longs liens Meet/Zoom, montre juste le domaine + path court
    try {
      const u = new URL(trimmed);
      label = u.host.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "");
      if (label.length > 40) label = label.slice(0, 37) + "…";
    } catch {
      // garde le lien tel quel
    }
  } else if (isPhone) {
    href = `tel:${trimmed.replace(/[\s().-]/g, "")}`;
    iconName = "Phone";
    title = "Appeler ce numéro";
  } else {
    href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
    iconName = "MapPin";
    title = "Ouvrir dans Google Maps";
  }

  const textClass = size === "sm" ? "text-[11px]" : "text-xs";
  const iconClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <a
      href={href}
      target={isPhone ? "_self" : "_blank"}
      rel={isPhone ? undefined : "noopener noreferrer"}
      className={`inline-flex items-center gap-1 ${textClass} text-primary hover:underline`}
      onClick={(e) => e.stopPropagation()}
      title={title}
    >
      <Icon name={iconName} className={iconClass} />
      <span className="truncate">{label}</span>
    </a>
  );
}
