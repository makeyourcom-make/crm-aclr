"use server";

/**
 * Outils LPD/RGPD sur une fiche (entreprise + son contact).
 *
 *  - exportProspectData : droit d'accès → renvoie TOUT ce qu'on détient
 *    (fiche, activités, emails, deals, contrats, tags) en JSON téléchargeable.
 *  - eraseProspectData : droit à l'effacement →
 *      • aucune obligation comptable (pas de contrat) → suppression complète
 *      • sinon → ANONYMISATION : on efface les données personnelles du contact
 *        et la correspondance, mais on conserve les données de facturation
 *        légalement obligatoires (rétention 10 ans en Suisse).
 *
 * Réservé à l'admin. Chaque opération est tracée dans le journal d'audit.
 */
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function exportProspectData(id: string) {
  const admin = await requireAdmin();
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: {
      assigneA: { select: { name: true } },
      tags: { include: { tag: { select: { nom: true } } } },
      activities: true,
      emails: {
        select: {
          id: true,
          direction: true,
          objet: true,
          contenuTexte: true,
          expediteurEmail: true,
          destinataireEmail: true,
          envoyeLe: true,
          createdAt: true,
        },
      },
      deals: true,
      contracts: { select: { id: true, numero: true, statut: true, createdAt: true } },
    },
  });
  if (!prospect) return { ok: false as const, error: "Fiche introuvable." };

  await audit("prospect.gdpr_export", {
    userId: admin.id,
    entity: "Prospect",
    entityId: id,
  });

  return {
    ok: true as const,
    data: {
      _meta: {
        exportePar: admin.name,
        objet: "Export LPD/RGPD — toutes les données détenues sur cette fiche",
      },
      fiche: prospect,
    },
  };
}

export async function eraseProspectData(id: string) {
  const admin = await requireAdmin();
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    select: {
      id: true,
      raisonSociale: true,
      _count: { select: { contracts: true } },
    },
  });
  if (!prospect) return { ok: false as const, error: "Fiche introuvable." };

  // 1) Aucune obligation comptable → suppression complète possible.
  if (prospect._count.contracts === 0) {
    try {
      await prisma.prospect.delete({ where: { id } });
      await audit("prospect.gdpr_delete", {
        userId: admin.id,
        entity: "Prospect",
        entityId: id,
        metadata: { raisonSociale: prospect.raisonSociale },
      });
      revalidatePath("/prospects");
      return { ok: true as const, mode: "deleted" as const };
    } catch {
      // Une autre relation Restrict bloque → on bascule sur l'anonymisation.
    }
  }

  // 2) Anonymisation : on efface les données PERSONNELLES + la correspondance,
  //    on garde la raison sociale/adresse (facturation légale).
  const tag = `[Données personnelles effacées (LPD/RGPD) le ${new Date()
    .toISOString()
    .slice(0, 10)}]`;
  await prisma.$transaction([
    prisma.prospect.update({
      where: { id },
      data: {
        contactNom: null,
        contactPrenom: null,
        contactFonction: null,
        email: null,
        telephone: null,
        telephoneMobile: null,
        linkedIn: null,
        facebook: null,
        instagram: null,
        notesGenerales: tag,
      },
    }),
    prisma.activity.updateMany({
      where: { prospectId: id },
      data: { contenu: tag },
    }),
    prisma.email.updateMany({
      where: { prospectId: id },
      data: { contenuTexte: tag, contenuHtml: "", expediteurNom: null },
    }),
  ]);

  await audit("prospect.gdpr_anonymize", {
    userId: admin.id,
    entity: "Prospect",
    entityId: id,
    metadata: { raisonSociale: prospect.raisonSociale },
  });
  revalidatePath("/prospects");
  revalidatePath(`/prospects/${id}`);
  return { ok: true as const, mode: "anonymized" as const };
}
