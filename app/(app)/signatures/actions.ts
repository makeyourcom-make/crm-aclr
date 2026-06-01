"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { SIGNATURE_EXPIRATION_JOURS_DEFAULT } from "@/lib/constants";
import { requireUser } from "@/lib/session";

export interface SignatureActionResult {
  ok: boolean;
  signatureId?: string;
  lienSignature?: string;
  error?: string;
}

/**
 * Crée une demande de signature pour un contrat.
 * Génère un token aléatoire 32 chars et l'URL publique /sign/{token}.
 */
export async function createSignatureRequest(
  contractId: string,
): Promise<SignatureActionResult> {
  const user = await requireUser();
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { assigneAId: true },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };
  if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
    return { ok: false, error: "Ce contrat ne t'appartient pas." };
  }

  const token = randomBytes(24).toString("base64url");
  const expireA = new Date();
  expireA.setDate(
    expireA.getDate() + SIGNATURE_EXPIRATION_JOURS_DEFAULT,
  );

  const sig = await prisma.signature.create({
    data: {
      contractId,
      type: "SIGNATURE_ELECTRONIQUE",
      statut: "ENVOYEE",
      lienSignature: token,
      documentPdfUrl: `/api/contrats/${contractId}/pdf`,
      expireA,
    },
  });
  revalidatePath("/signatures");
  revalidatePath(`/contrats/${contractId}`);
  return {
    ok: true,
    signatureId: sig.id,
    lienSignature: token,
  };
}

/**
 * Action de signature côté client (page publique).
 * Vérifie le token, marque signed-by-client, capture nom + signature
 * manuscrite + IP.
 *
 * @param input.nomClient        nom complet tapé par le client (audit)
 * @param input.signatureDataUrl PNG base64 du tracé manuscrit (souris/doigt)
 */
export async function signByClient(
  token: string,
  input: { nomClient: string; signatureDataUrl: string; ipClient?: string },
): Promise<SignatureActionResult> {
  // Pas d'auth — c'est la page publique
  const sig = await prisma.signature.findUnique({
    where: { lienSignature: token },
  });
  if (!sig) return { ok: false, error: "Lien invalide." };
  if (sig.expireA < new Date()) {
    return { ok: false, error: "Lien expiré." };
  }
  if (sig.signeParClient) {
    return { ok: false, error: "Déjà signé par le client." };
  }
  if (!input.nomClient || input.nomClient.trim().length < 3) {
    return { ok: false, error: "Nom complet requis (min 3 caractères)." };
  }
  if (
    !input.signatureDataUrl ||
    !input.signatureDataUrl.startsWith("data:image/")
  ) {
    return { ok: false, error: "Signature manuscrite manquante." };
  }
  // Garde-fou taille (évite les abus, ~150 KB max)
  if (input.signatureDataUrl.length > 200_000) {
    return { ok: false, error: "Signature trop volumineuse." };
  }

  // Transaction : signature + propagation du statut (deal → SIGNE,
  // prospect → SIGNE). C'est l'acte de signature client qui déclenche
  // ces changements, PAS la création du contrat.
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.signature.update({
      where: { id: sig.id },
      data: {
        signeParClient: true,
        dateSignatureClient: now,
        nomClient: input.nomClient.trim(),
        signatureClientDataUrl: input.signatureDataUrl,
        ipClient: input.ipClient ?? null,
        statut: sig.signeParAclr ? "COMPLETEE" : "SIGNEE_CLIENT",
      },
    });

    // Charge le contrat pour récupérer le deal + prospect
    const contract = await tx.contract.findUnique({
      where: { id: sig.contractId },
      select: { dealId: true, prospectId: true },
    });
    if (contract) {
      // Deal → SIGNE + 100% + closeReelLe (si rattaché)
      if (contract.dealId) {
        await tx.deal.update({
          where: { id: contract.dealId },
          data: {
            stage: "SIGNE",
            probabilite: 100,
            closeReelLe: now,
          },
        });
      }
      // Prospect → SIGNE (sortira de /prospects, rejoindra /contrats)
      await tx.prospect.update({
        where: { id: contract.prospectId },
        data: { statut: "SIGNE" },
      });
    }
  });

  revalidatePath("/signatures");
  revalidatePath("/pipeline");
  revalidatePath("/prospects");
  revalidatePath("/contrats");
  revalidatePath(`/contrats/${sig.contractId}`);
  return { ok: true, signatureId: sig.id };
}

/**
 * Contre-signature côté ACLR (admin).
 */
export async function signByAclr(
  signatureId: string,
): Promise<SignatureActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Seul l'admin peut contre-signer." };
  }
  const sig = await prisma.signature.findUnique({
    where: { id: signatureId },
  });
  if (!sig) return { ok: false, error: "Signature introuvable." };
  if (sig.signeParAclr) {
    return { ok: false, error: "Déjà contre-signé." };
  }
  await prisma.signature.update({
    where: { id: sig.id },
    data: {
      signeParAclr: true,
      dateSignatureAclr: new Date(),
      statut: sig.signeParClient ? "COMPLETEE" : "SIGNEE_ACLR",
    },
  });
  // La contre-signature admin fait sortir le deal du pipeline (filtre dans
  // lib/queries/deals.ts). Il faut donc rafraîchir les routes concernées.
  revalidatePath("/signatures");
  revalidatePath("/pipeline");
  revalidatePath("/contrats");
  revalidatePath(`/contrats/${sig.contractId}`);
  return { ok: true, signatureId: sig.id };
}
