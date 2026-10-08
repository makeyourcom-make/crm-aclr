/**
 * URL de base PUBLIQUE de l'app, pour tout lien destiné à un tiers sans compte
 * CRM : liens de signature `/sign/{token}`, PDF de contrat `?token=`, QR codes.
 *
 * On dérive le domaine réel de la requête (headers, derrière Vercel), MAIS on
 * ignore tout host local / preview : un lien `http://localhost:3000/...` envoyé
 * ou affiché pour un client est injoignable (c'est la machine du commercial).
 * Repli : APP_URL, puis l'URL de prod.
 *
 * Doit être appelé dans un contexte de requête (Server Component / Server
 * Action). Hors requête, retombe sur le repli.
 */
const PROD_FALLBACK = "https://crm.makeyourcom.ch";

/** True si le host est local/preview et ne doit JAMAIS finir dans un lien public. */
export function isLocalHost(host: string): boolean {
  return (
    /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(host) ||
    host.endsWith(".local")
  );
}

export async function publicBaseUrl(): Promise<string> {
  const fallback = process.env.APP_URL || PROD_FALLBACK;
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host && !isLocalHost(host)) return `${proto}://${host}`;
  } catch {
    // headers() indisponible (hors requête) → repli
  }
  return fallback;
}
