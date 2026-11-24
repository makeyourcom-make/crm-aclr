/**
 * GET /api/contrats/[id]/pdf — génère le PDF complet du contrat
 * (bon de commande + signatures + CGV annexées).
 *
 * Accessible :
 *   - À l'admin et à la commerciale assignée (RLS)
 *   - SANS auth si l'URL inclut ?token={lienSignature} valide → le client
 *     peut récupérer le PDF depuis la page publique de signature.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { resolveBanner, resolveLogoDataUrl } from "@/lib/pdf/brand-assets";
import {
  ContractPdf,
  type ContractPdfData,
} from "@/lib/pdf/contract-template";
import { getSessionUser } from "@/lib/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const publicToken = url.searchParams.get("token");

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      assigneA: { select: { id: true, name: true } },
      prospect: {
        select: {
          raisonSociale: true,
          contactPrenom: true,
          contactNom: true,
          adresse: true,
          codePostal: true,
          ville: true,
          pays: true,
          numeroIDE: true,
          numeroTVA: true,
        },
      },
      products: {
        // Nom + description + prix par ligne (frais unique / mensuel). Ces
        // prix viennent de la fiche produit et peuvent diverger des totaux
        // figés du contrat ; les totaux en bas du PDF restent la référence.
        select: {
          id: true,
          nom: true,
          description: true,
          prixOneShot: true,
          prixMensuel: true,
        },
      },
      signatures: {
        select: {
          lienSignature: true,
          nomClient: true,
          dateSignatureClient: true,
          ipClient: true,
          signatureClientDataUrl: true,
          signeParAclr: true,
          dateSignatureAclr: true,
          signatureAclrDataUrl: true,
          nomAclr: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!contract) return new NextResponse("Not found", { status: 404 });

  // Auth : soit session, soit token de signature publique
  if (publicToken) {
    const tokenMatch = contract.signatures.some(
      (s) => s.lienSignature === publicToken,
    );
    if (!tokenMatch) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  } else {
    const user = await getSessionUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });
    if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const setting = await prisma.setting.findFirst();
  const latestSignature = contract.signatures[0];
  const banner = resolveBanner();

  // Métadonnées de ligne (prix d'origine / offert / remise) pour l'affichage
  // "prix barré + mention" sur le PDF. Stockées sur contract.lignesMeta.
  type Cible = "ONESHOT" | "RECURRENT" | "DEUX" | null;
  type LigneMeta = {
    productId: string;
    quantite?: number | null;
    prixOneShotOriginal?: number | null;
    prixMensuelOriginal?: number | null;
    offert?: boolean;
    offertCible?: Cible;
    remiseType?: "POURCENT" | "MONTANT" | null;
    remiseValeur?: number | null;
    remiseCible?: Cible;
    remiseDureeMois?: number | null;
  };
  const metaArr: LigneMeta[] = Array.isArray(contract.lignesMeta)
    ? (contract.lignesMeta as unknown as LigneMeta[])
    : [];
  const metaByProduct = new Map(metaArr.map((m) => [m.productId, m]));

  // Prix EFFECTIF par part (après offert / remise + cible) — calculé depuis
  // les méta du CONTRAT, jamais depuis le produit du catalogue (qui garde son
  // prix de base, propre à un autre contrat).
  const effectivePart = (
    base: number,
    part: "ONESHOT" | "RECURRENT",
    m?: LigneMeta,
  ): number => {
    if (!m) return base;
    if (m.offert) {
      const c = m.offertCible ?? "DEUX";
      if (part === "ONESHOT" && c !== "RECURRENT") return 0;
      if (part === "RECURRENT" && c !== "ONESHOT") return 0;
      return base;
    }
    const r = m.remiseValeur ?? 0;
    if (m.remiseType && r > 0) {
      const c = m.remiseCible ?? "DEUX";
      // Remise récurrente BORNÉE = promo temporaire : le mensuel affiché reste
      // au plein tarif (le rabais est appliqué sur les factures des N premiers
      // mois, pas sur le prix contractuel).
      const borne = (m.remiseDureeMois ?? 0) > 0;
      const applies =
        (part === "ONESHOT" && c !== "RECURRENT") ||
        (part === "RECURRENT" && c !== "ONESHOT" && !borne);
      if (!applies) return base;
      if (m.remiseType === "POURCENT") return base * Math.max(0, 1 - r / 100);
      return Math.max(0, base - r);
    }
    return base;
  };

  // Libellé promo (remise récurrente bornée) affiché en toutes lettres.
  const devise = contract.devise ?? "CHF";
  const promoLabelOf = (
    m: LigneMeta | undefined,
    baseMens: number,
  ): string | null => {
    if (!m?.remiseType) return null;
    const n = m.remiseDureeMois ?? 0;
    const r = m.remiseValeur ?? 0;
    if (n <= 0 || r <= 0) return null;
    if ((m.remiseCible ?? "DEUX") === "ONESHOT") return null;
    const mois = n === 1 ? "le 1er mois" : `les ${n} premiers mois`;
    const red =
      m.remiseType === "POURCENT"
        ? baseMens * Math.min(1, r / 100)
        : Math.min(baseMens, r);
    if (red >= baseMens - 0.001)
      return n === 1 ? "1er mois offert" : `${n} premiers mois offerts`;
    const val =
      m.remiseType === "POURCENT"
        ? `${r} %`
        : `${r.toLocaleString("fr-CH", { maximumFractionDigits: 2 })} ${devise}`;
    return `−${val} / mois ${mois}`;
  };

  const data: ContractPdfData = {
    numero: contract.numero,
    devise: contract.devise ?? "CHF",
    dateSignature: contract.dateSignature,
    dateDebut: contract.dateDebut,
    dureeMois: contract.dureeMois,
    modalitePaiement: contract.modalitePaiement,
    note: contract.note,
    montantOneShot: Number(contract.montantOneShot),
    montantMensuel: Number(contract.montantMensuel),
    valeurAn1: Number(contract.valeurAn1),
    emetteur: {
      raisonSociale: setting?.raisonSociale ?? "ACLR Sàrl",
      adresse: setting?.adresse ?? undefined,
      codePostal: setting?.codePostal ?? undefined,
      ville: setting?.ville ?? undefined,
      pays: setting?.pays ?? "Suisse",
      numeroIDE: setting?.numeroIDE ?? undefined,
      numeroTVA: setting?.numeroTVA ?? undefined,
      logoPath: resolveLogoDataUrl(),
      bannerPath: banner?.dataUrl,
      bannerHeightPt: banner?.heightPt,
    },
    client: {
      raisonSociale: contract.prospect.raisonSociale,
      contactNom:
        [contract.prospect.contactPrenom, contract.prospect.contactNom]
          .filter(Boolean)
          .join(" ") || undefined,
      adresse: contract.prospect.adresse ?? undefined,
      codePostal: contract.prospect.codePostal ?? undefined,
      ville: contract.prospect.ville ?? undefined,
      pays: contract.prospect.pays ?? undefined,
      numeroIDE: contract.prospect.numeroIDE ?? undefined,
      numeroTVA: contract.prospect.numeroTVA ?? undefined,
    },
    produits: contract.products.map((p) => {
      const meta = metaByProduct.get(p.id);
      // Prix produit = repli pour les anciens contrats sans méta.
      const prodOne = p.prixOneShot != null ? Number(p.prixOneShot) : null;
      const prodMens = p.prixMensuel != null ? Number(p.prixMensuel) : null;
      // Colonne "Prix" = prix de la ligne DU CONTRAT (méta) — sinon prix produit.
      const baseOne = meta?.prixOneShotOriginal ?? prodOne;
      const baseMens = meta?.prixMensuelOriginal ?? prodMens;
      return {
        nom: p.nom,
        description: p.description,
        quantite: meta?.quantite ?? 1,
        prixOneShot: baseOne,
        prixMensuel: baseMens,
        // Colonne "Total" = effectif après offert/remise, calculé depuis la
        // méta du contrat (jamais depuis le catalogue).
        prixOneShotEff: effectivePart(baseOne ?? 0, "ONESHOT", meta),
        prixMensuelEff: effectivePart(baseMens ?? 0, "RECURRENT", meta),
        offert: meta?.offert ?? false,
        remiseType: meta?.remiseType ?? null,
        remiseValeur: meta?.remiseValeur ?? null,
        promo: promoLabelOf(meta, baseMens ?? 0),
      };
    }),
    signature: latestSignature
      ? {
          nomClient: latestSignature.nomClient,
          dateSignatureClient: latestSignature.dateSignatureClient,
          ipClient: latestSignature.ipClient,
          signatureClientDataUrl: latestSignature.signatureClientDataUrl,
          signeParAclr: latestSignature.signeParAclr,
          dateSignatureAclr: latestSignature.dateSignatureAclr,
          signatureAclrDataUrl: latestSignature.signatureAclrDataUrl,
          nomAclr: latestSignature.nomAclr,
        }
      : undefined,
  };

  const buffer = await renderToBuffer(<ContractPdf data={data} />);
  const bytes = new Uint8Array(buffer);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${contract.numero}.pdf"`,
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
