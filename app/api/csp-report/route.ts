/**
 * Réception des rapports de violation CSP (mode Report-Only).
 *
 * Le navigateur POST ici quand une ressource enfreindrait la politique. On
 * loggue pour pouvoir, après observation, durcir la CSP en mode bloquant sans
 * casser l'application. Endpoint public (le navigateur n'envoie pas de session)
 * → exempté du middleware d'auth.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const report = body?.["csp-report"] ?? body;
    const directive =
      report?.["violated-directive"] ?? report?.effectiveDirective ?? "?";
    const blocked = report?.["blocked-uri"] ?? report?.blockedURL ?? "?";
    const doc = report?.["document-uri"] ?? report?.documentURL ?? "?";
    console.warn(
      `[CSP] violation: directive=${directive} blocked=${blocked} doc=${doc}`,
    );
  } catch {
    // rapport illisible — on ignore
  }
  // 204 : pas de contenu, le navigateur n'attend rien.
  return new NextResponse(null, { status: 204 });
}
