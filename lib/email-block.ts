/**
 * Filtrage anti-spam des emails ENTRANTS.
 *
 * Trois types de règle :
 *   - SENDER  : adresse expéditeur exacte      (ex. "isabelle_wyss@aiboost24.ch")
 *   - DOMAIN  : domaine expéditeur              (ex. "aiboost24.ch")
 *   - SUBJECT : mot-clé présent dans l'objet    (ex. "rabatt")
 *
 * Un mail qui matche une règle active part directement dans le dossier Spam
 * (supprime=true + label "spam" : jamais supprimé pour de bon, récupérable via
 * « Pas un spam »), sans créer d'Activity ni compter comme non-lu. Le filtre s'applique à la RÉCEPTION (webhook) ; les règles vivent en
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
  return findAllBlockingRules(fromEmail, subject, rules)[0] ?? null;
}

/**
 * Renvoie TOUTES les règles qui bloquent ce mail (un même mail peut matcher
 * une adresse, un domaine et un mot-clé). Sert à « Pas un spam » : on
 * désactive l'ensemble des règles fautives, sinon le mail suivant repart en spam.
 */
export function findAllBlockingRules<R extends BlockRuleLite>(
  fromEmail: string | null,
  subject: string | null,
  rules: R[],
): R[] {
  const from = (fromEmail ?? "").toLowerCase().trim();
  const domain = from.includes("@") ? from.split("@")[1]! : "";
  const subj = (subject ?? "").toLowerCase();

  return rules.filter((r) => {
    const v = r.value.toLowerCase().trim();
    if (!v) return false;
    if (r.type === "SENDER") return from === v;
    if (r.type === "DOMAIN") return domain === v || domain.endsWith(`.${v}`);
    return subj.includes(v); // SUBJECT
  });
}

/** Libellé lisible d'une règle (toasts, confirmations). */
export function describeBlockRule(r: BlockRuleLite): string {
  if (r.type === "SENDER") return `adresse ${r.value}`;
  if (r.type === "DOMAIN") return `domaine ${r.value}`;
  return `mot-clé « ${r.value} »`;
}

/** Marqueur posé sur un mail filtré : il vit dans le dossier Spam. */
export const SPAM_LABEL = "spam";
