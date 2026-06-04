import { Icon } from "@/components/icon";

/**
 * Affiche une adresse de RDV cliquable. Le clic ouvre Google Maps
 * dans un nouvel onglet avec l'adresse en query (`?q=<adresse>`).
 *
 * Si l'adresse contient déjà une URL (http(s)://, ex. lien Google Meet ou
 * Maps direct), on l'utilise telle quelle.
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
  const href = isUrl
    ? trimmed
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;

  const textClass = size === "sm" ? "text-[11px]" : "text-xs";
  const iconClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 ${textClass} text-primary hover:underline`}
      onClick={(e) => e.stopPropagation()}
      title={isUrl ? "Ouvrir le lien" : "Ouvrir dans Google Maps"}
    >
      <Icon name="MapPin" className={iconClass} />
      <span className="truncate">{trimmed}</span>
    </a>
  );
}
