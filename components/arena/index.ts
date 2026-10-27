/**
 * Kit d'interface Make Your Com (cartes, tuiles, jauges, pastilles),
 * réutilisable par toutes les rubriques.
 *
 * Tout est server-safe SAUF `celebrate.tsx` (client : celebrate(),
 * resultToast(), <CelebrationHost />) : les appeler uniquement depuis un
 * composant client (gestionnaire d'événement, retour d'action serveur…).
 *
 * Déprécié (XP / niveaux / badges, à ne plus utiliser) : xp-bar (XpBar),
 * mission-card (MissionCard), badge-medal (BadgeMedal), LevelPill / XpPill
 * de pills, formatXp / formatSignedXp de format, xpToast.
 */
export * from "./tones";
export * from "./format";
export * from "./progress-ring";
export * from "./meter";
export * from "./xp-bar";
export * from "./hero-panel";
export * from "./stat-tile";
export * from "./money-stat";
export * from "./section-card";
export * from "./mission-card";
export * from "./badge-medal";
export * from "./pills";
export * from "./player-avatar";
export * from "./rubrique-icon";
export * from "./empty-state";
// Module client : réexports nommés (frontière "use client").
export {
  celebrate,
  resultToast,
  xpToast,
  CelebrationHost,
  type CelebrateOptions,
} from "./celebrate";
