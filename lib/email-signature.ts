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

const NAVY = "#0E1936";
const CORAL = "#F47174";
const MUTED = "#64748B";

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

/** Construit le HTML de la signature. */
export function buildSignatureHtml(f: SignatureFields): string {
  const name = esc(f.displayName.trim());
  const fonction = f.fonction?.trim() ? esc(f.fonction.trim()) : "";
  const entreprise = f.entreprise?.trim() ? esc(f.entreprise.trim()) : "";
  const tel = f.telephone?.trim() ?? "";
  const email = f.email?.trim() ?? "";
  const web = f.siteWeb?.trim() ?? "";
  const logo = f.logoUrl?.trim() ?? "";

  const contactLines: string[] = [];
  if (tel) {
    const telClean = tel.replace(/[^\d+]/g, "");
    contactLines.push(
      `<a href="tel:${esc(telClean)}" style="color:${MUTED};text-decoration:none;">${esc(tel)}</a>`,
    );
  }
  if (email) {
    contactLines.push(
      `<a href="mailto:${esc(email)}" style="color:${MUTED};text-decoration:none;">${esc(email)}</a>`,
    );
  }
  if (web) {
    contactLines.push(
      `<a href="${esc(href(web))}" style="color:${CORAL};text-decoration:none;">${esc(web.replace(/^https?:\/\//i, ""))}</a>`,
    );
  }
  const contactHtml = contactLines.join(
    ` <span style="color:#CBD5E1;">|</span> `,
  );

  const logoCell = logo
    ? `<td style="padding-right:14px;vertical-align:middle;">
         <img src="${esc(href(logo))}" alt="${entreprise || "Logo"}" height="48" style="display:block;border:0;max-height:48px;" />
       </td>`
    : "";

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${NAVY};line-height:1.45;">
  <tr>
    ${logoCell}
    <td style="vertical-align:middle;${logo ? `border-left:2px solid ${CORAL};padding-left:14px;` : ""}">
      <div style="font-weight:bold;font-size:15px;color:${NAVY};">${name}</div>
      ${fonction ? `<div style="color:${MUTED};">${fonction}${entreprise ? ` · ${entreprise}` : ""}</div>` : entreprise ? `<div style="color:${MUTED};">${entreprise}</div>` : ""}
      ${contactHtml ? `<div style="margin-top:6px;font-size:12px;">${contactHtml}</div>` : ""}
    </td>
  </tr>
</table>`;
}
