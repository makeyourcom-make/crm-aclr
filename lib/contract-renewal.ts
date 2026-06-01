/**
 * Calcule la prochaine date de renouvellement / fin d'un contrat.
 *
 * Logique :
 *   - Contrat NON ACTIF (résilié, expiré, suspendu) → null
 *   - Contrat "mission unique" (1 mois, ou pas de mensuel/oneShot répété) → null
 *   - Autres : dateDebut + dureeMois, projeté dans le futur si déjà passé
 *
 * Pour les contrats reconductibles annuellement (typique gestion site/SaaS),
 * la fonction renvoie la prochaine date anniversaire à partir d'aujourd'hui.
 */
export interface ContractRenewalInput {
  dateDebut: Date;
  dureeMois: number;
  statut: string;
  /**
   * Si true, on considère que le contrat se reconduit tacitement
   * (= la fin = nouvelle date anniversaire). Sinon, dateDebut + dureeMois
   * est une date "fin de contrat" sans renouvellement.
   */
  reconductible?: boolean;
}

export function getNextRenewalDate(
  contract: ContractRenewalInput,
  now: Date = new Date(),
): Date | null {
  if (contract.statut !== "ACTIF") return null;
  if (!contract.dateDebut) return null;

  const start = new Date(contract.dateDebut);
  const duration = Math.max(1, contract.dureeMois);

  // Calcule la date de fin courante (= dateDebut + dureeMois)
  const end = new Date(start);
  end.setMonth(end.getMonth() + duration);

  // Si pas reconductible, c'est la date de fin sèche
  if (contract.reconductible === false) {
    return end > now ? end : null;
  }

  // Reconductible (défaut) : on projette dans le futur par cycles
  let next = end;
  while (next <= now) {
    next = new Date(next);
    next.setMonth(next.getMonth() + duration);
  }
  return next;
}

/** Format court "dans 23 jours" / "il y a 5 jours" pour affichage UI. */
export function relativeDays(
  date: Date,
  now: Date = new Date(),
): { days: number; label: string } {
  const diff = Math.round((date.getTime() - now.getTime()) / 86400_000);
  if (diff === 0) return { days: 0, label: "aujourd'hui" };
  if (diff > 0) return { days: diff, label: `dans ${diff} j` };
  return { days: diff, label: `il y a ${-diff} j` };
}
