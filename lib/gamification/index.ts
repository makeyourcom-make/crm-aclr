/**
 * MYC Arena - point d'entrée du moteur de gamification (SERVEUR).
 *
 * Ré-exporte les règles pures et les requêtes. Ce module tire prisma via
 * `engine.ts` : depuis un composant client, importer
 * `@/lib/gamification/rules` à la place.
 */
export * from "./rules";
export * from "./engine";
