/**
 * Résultats commerciaux - point d'entrée (SERVEUR).
 *
 * Ré-exporte les règles pures et les requêtes (getPlayerHeader,
 * getPlayerStats, getWeeklyLeaderboard, getMonthlyLeaderboard,
 * getDayCounters). Ce module tire prisma via `engine.ts` : depuis un
 * composant client, importer `@/lib/gamification/rules` à la place.
 */
export * from "./rules";
export * from "./engine";
