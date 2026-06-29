/**
 * Assainissement HTML côté serveur (signatures email, contenus riches).
 *
 * Allowlist stricte : on autorise la mise en forme basique + liens + images,
 * mais JAMAIS <script>, <style>, les gestionnaires d'événements (onclick…)
 * ni les URL javascript: → neutralise tout XSS stocké.
 */
import sanitizeHtml from "sanitize-html";

export function sanitizeSignatureHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? "", {
    allowedTags: [
      "a", "b", "i", "em", "strong", "u", "s", "br", "p", "div", "span",
      "ul", "ol", "li", "blockquote", "hr",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "img", "table", "thead", "tbody", "tr", "td", "th",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      "*": ["style"],
    },
    // Seuls http/https/mailto/tel + images data: — pas de javascript:
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    // Bloque les styles dangereux (position/expression) en limitant les props.
    allowedStyles: {
      "*": {
        color: [/^.*$/],
        "background-color": [/^.*$/],
        "font-size": [/^.*$/],
        "font-weight": [/^.*$/],
        "font-style": [/^.*$/],
        "text-align": [/^.*$/],
        "text-decoration": [/^.*$/],
        margin: [/^.*$/],
        padding: [/^.*$/],
        width: [/^.*$/],
        height: [/^.*$/],
      },
    },
    transformTags: {
      // Force rel="noopener" sur les liens ouverts dans un nouvel onglet.
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}
