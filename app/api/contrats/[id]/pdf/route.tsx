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
        // On NE charge PAS les prix individuels — ils peuvent diverger des
        // totaux réellement contractés (override à la signature, MAJ
        // catalogue ultérieure). Le PDF affiche la liste des prestations
        // + les totaux figés du contrat. Détail tarifaire = sur la facture.
        select: { nom: true, description: true },
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

  const data: ContractPdfData = {
    numero: contract.numero,
    devise: contract.devise ?? "CHF",
    dateSignature: contract.dateSignature,
    dateDebut: contract.dateDebut,
    dureeMois: contract.dureeMois,
    modalitePaiement: contract.modalitePaiement,
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
    produits: contract.products.map((p) => ({
      nom: p.nom,
      description: p.description,
    })),
    signature: latestSignature
      ? {
          nomClient: latestSignature.nomClient,
          dateSignatureClient: latestSignature.dateSignatureClient,
          ipClient: latestSignature.ipClient,
          signatureClientDataUrl: latestSignature.signatureClientDataUrl,
          signeParAclr: latestSignature.signeParAclr,
          dateSignatureAclr: latestSignature.dateSignatureAclr,
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
