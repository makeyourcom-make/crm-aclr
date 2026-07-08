/**
 * Nettoyage / conversion du HTML de rédaction des emails.
 *
 * Le composeur riche (gras/italique/souligné/listes) produit du HTML via
 * `contentEditable`. Avant de l'envoyer ou de le stocker, on le passe par
 * `sanitizeEmailHtml` pour ne garder qu'une liste blanche de balises et
 * retirer tout script / attribut dangereux. `htmlToPlainText` sert à
 * dériver la version texte (partie text/plain de l'email + aperçu/activité).
 *
 * Utilisateurs = staff interne de confiance ; le but est surtout d'éviter
 * d'envoyer du HTML cassé/injecté, pas de se prémunir d'un attaquant.
 */

const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "br",
  "p",
  "div",
  "ul",
  "ol",
  "li",
  "a",
  "span",
  "pre",
  "h1",
  "h2",
  "h3",
]);

/** Retire scripts/styles/iframes et toute balise/attribut hors liste blanche. */
export function sanitizeEmailHtml(input: string | null | undefined): string {
  if (!input) return "";
  let html = input;

  // Supprime entièrement les blocs dangereux (contenu inclus).
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|head|title)[\s\S]*?<\/\s*\1\s*>/gi,
    "",
  );
  // Et leurs versions auto-fermantes / orphelines.
  html = html.replace(
    /<\s*\/?\s*(script|style|iframe|object|embed|link|meta|head|title)[^>]*>/gi,
    "",
  );

  // Parcourt chaque balise : garde celles de la liste blanche (sans attribut,
  // sauf href sur <a>), supprime les autres en conservant leur contenu.
  html = html.replace(
    /<(\/?)([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (_m, close: string, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(t)) return "";
      if (close) return `</${t}>`;
      if (t === "a") {
        const hrefMatch = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
        const href = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? "") : "";
        const safe = /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : "";
        return safe
          ? `<a href="${safe.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">`
          : "<a>";
      }
      return `<${t}>`;
    },
  );

  return html.trim();
}

/** Convertit du HTML en texte brut lisible (retours à la ligne préservés). */
export function htmlToPlainText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h1|h2|h3)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Vrai si le HTML ne contient aucun texte visible (utile pour la validation). */
export function isHtmlEmpty(input: string | null | undefined): boolean {
  return htmlToPlainText(input).length === 0;
}
