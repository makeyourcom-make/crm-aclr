/**
 * MYC Arena : composants du jeu, réutilisables par toutes les rubriques.
 *
 * Tout est server-safe SAUF `celebrate.tsx` (client : celebrate(), xpToast(),
 * <CelebrationHost />) : appeler celebrate() / xpToast() uniquement depuis un
 * composant client (gestionnaire d'événement, retour d'action serveur…).
 */
export * from "./tones";
export * from "./format";
export * from "./progress-ring";
export * from "./meter";
export * from "./xp-bar";
export * from "./hero-panel";
export * from "./stat-tile";
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
  xpToast,
  CelebrationHost,
  type CelebrateOptions,
} from "./celebrate";
