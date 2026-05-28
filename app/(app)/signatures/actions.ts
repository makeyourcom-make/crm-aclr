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
 * Vérifie le token, marque signed-by-client, capture l'IP.
 */
export async function signByClient(
  token: string,
  ipClient?: string,
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
  await prisma.signature.update({
    where: { id: sig.id },
    data: {
      signeParClient: true,
      dateSignatureClient: new Date(),
      ipClient: ipClient ?? null,
      statut: sig.signeParAclr ? "COMPLETEE" : "SIGNEE_CLIENT",
    },
  });
  revalidatePath("/signatures");
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
  revalidatePath("/signatures");
  return { ok: true, signatureId: sig.id };
}
