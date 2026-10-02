/**
 * Génération d'une signature email HTML à partir de champs guidés.
 * HTML table-based (compatible clients email) aux couleurs Make Your Com.
 */

export interface SignatureFields {
  displayName: string;
  fonction?: string | null;
  telephone?: string | null;
  email?: string | null;
  siteWeb?: string | null;
  entreprise?: string | null;
  logoUrl?: string | null;
}

// Teinte du fond du logo wordmark (#070F33) : le bandeau utilise la MÊME
// couleur pour que le logo blanc s'y fonde sans rectangle visible.
const NAVY = "#070F33";
const CORAL = "#F47174";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Normalise une URL (ajoute https:// si absent) pour les liens. */
function href(url: string): string {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

/** Construit le HTML de la signature — bandeau bleu marine, texte blanc,
 *  accents orange (site + séparateurs). Table-based, compatible clients email. */
export function buildSignatureHtml(f: SignatureFields): string {
  const name = esc(f.displayName.trim());
  const fonction = f.fonction?.trim() ? esc(f.fonction.trim()) : "";
  const entreprise = f.entreprise?.trim() ? esc(f.entreprise.trim()) : "";
  const tel = f.telephone?.trim() ?? "";
  const email = f.email?.trim() ?? "";
  const web = f.siteWeb?.trim() ?? "";
  const logo = f.logoUrl?.trim() ?? "";
  const WHITE = "#FFFFFF";
  const LIGHT = "#D8DEE8";

  const contactLines: string[] = [];
  if (tel) {
    const telClean = tel.replace(/[^\d+]/g, "");
    contactLines.push(
      `<a href="tel:${esc(telClean)}" style="color:${WHITE};text-decoration:none;">${esc(tel)}</a>`,
    );
  }
  if (email) {
    contactLines.push(
      `<a href="mailto:${esc(email)}" style="color:${WHITE};text-decoration:none;">${esc(email)}</a>`,
    );
  }
  if (web) {
    contactLines.push(
      `<a href="${esc(href(web))}" style="color:${CORAL};text-decoration:none;">${esc(web.replace(/^https?:\/\//i, ""))}</a>`,
    );
  }
  const contactHtml = contactLines.join(
    ` <span style="color:${CORAL};">|</span> `,
  );

  const logoCell = logo
    ? `<td style="padding-right:18px;vertical-align:middle;">
         <img src="${esc(href(logo))}" alt="${entreprise || "Make Your Com"}" height="52" style="display:block;border:0;max-height:52px;" />
       </td>`
    : "";

  // Bandeau navy pleine largeur : le fond couvre tout l'espace (logo + texte).
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:${NAVY};border-radius:8px;font-family:Arial,Helvetica,sans-serif;max-width:640px;">
  <tr>
    <td style="padding:16px 22px;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          ${logoCell}
          <td style="vertical-align:middle;${logo ? `border-left:2px solid ${CORAL};padding-left:18px;` : ""}">
            <div style="font-weight:bold;font-size:15px;color:${WHITE};line-height:1.35;">${name}</div>
            ${fonction ? `<div style="color:${LIGHT};font-size:13px;line-height:1.35;">${fonction}${entreprise ? ` · ${entreprise}` : ""}</div>` : entreprise ? `<div style="color:${LIGHT};font-size:13px;">${entreprise}</div>` : ""}
            ${contactHtml ? `<div style="margin-top:7px;font-size:12px;color:${WHITE};">${contactHtml}</div>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
