/**
 * Filtrage anti-spam des emails ENTRANTS.
 *
 * Trois types de règle :
 *   - SENDER  : adresse expéditeur exacte      (ex. "isabelle_wyss@aiboost24.ch")
 *   - DOMAIN  : domaine expéditeur              (ex. "aiboost24.ch")
 *   - SUBJECT : mot-clé présent dans l'objet    (ex. "rabatt")
 *
 * Un mail qui matche une règle active part directement à la corbeille (jamais
 * supprimé pour de bon — récupérable), sans créer d'Activity ni compter comme
 * non-lu. Le filtre s'applique à la RÉCEPTION (webhook) ; les règles vivent en
 * base (table email_block_rules) pour être ajoutées sans redéploiement.
 */

export interface BlockRuleLite {
  id: string;
  type: "SENDER" | "DOMAIN" | "SUBJECT";
  value: string;
}

/**
 * Renvoie la 1re règle qui bloque ce mail, ou null s'il passe.
 * Comparaisons insensibles à la casse ; `value` est supposée déjà en minuscules.
 */
export function findBlockingRule(
  fromEmail: string | null,
  subject: string | null,
  rules: BlockRuleLite[],
): BlockRuleLite | null {
  const from = (fromEmail ?? "").toLowerCase().trim();
  const domain = from.includes("@") ? from.split("@")[1]! : "";
  const subj = (subject ?? "").toLowerCase();

  for (const r of rules) {
    const v = r.value.toLowerCase().trim();
    if (!v) continue;
    if (r.type === "SENDER" && from === v) return r;
    if (r.type === "DOMAIN" && (domain === v || domain.endsWith(`.${v}`)))
      return r;
    if (r.type === "SUBJECT" && subj.includes(v)) return r;
  }
  return null;
}
