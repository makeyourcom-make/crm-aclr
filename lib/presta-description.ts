/**
 * Description d'une prestation telle que le CLIENT doit la voir (PDF du contrat,
 * page de signature en ligne).
 *
 * Les produits sur-mesure sont stockés « [Custom] <description saisie> » : le
 * préfixe est un marqueur interne (pour repérer ces produits au catalogue), mais
 * le texte qui suit est le vrai détail de la prestation et doit être affiché.
 * On ne masque que le texte AUTO-GÉNÉRÉ quand aucune description n'a été saisie.
 */
const AUTO_DESCRIPTIONS = [
  "produit sur-mesure créé depuis un deal.",
  "produit sur-mesure créé depuis un contrat.",
];

export function clientFacingDescription(desc?: string | null): string {
  if (!desc) return "";
  const t = desc
    .trim()
    .replace(/^\[custom\]\s*/i, "")
    .trim();
  if (AUTO_DESCRIPTIONS.includes(t.toLowerCase())) return "";
  return t;
}
