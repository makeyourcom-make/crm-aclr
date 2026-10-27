/**
 * Lecture du planning de production pour l'affichage (sérialisé pour le client).
 */
import { prisma } from "@/lib/db";
import { todayZurich } from "@/lib/planning/dates";

export interface PlanningRegleDTO {
  id: string;
  code: string;
  titre: string;
  frequence: string;
  fixe: boolean;
  fenetreDebut: number;
  fenetreFin: number;
  jours: number[];
  jourSemaine: number | null;
  dureeMin: number;
  actif: boolean;
}

export interface PlanningLigneDTO {
  id: string;
  prospectId: string;
  client: string;
  /** Localité du client (affichage « Vevey · ACLR-2026-0034 »). */
  ville: string | null;
  service: string;
  libelle: string | null;
  auto: boolean;
  fraisPubAvances: boolean;
  contratNumero: string | null;
  regles: PlanningRegleDTO[];
}

export interface PlanningTacheDTO {
  id: string;
  ligneId: string;
  regleId: string | null;
  code: string | null;
  titre: string;
  /** AAAA-MM-JJ */
  date: string;
  dureeMin: number;
  statut: "A_FAIRE" | "EN_COURS" | "ATTENTE_CLIENT" | "FAIT" | "ABANDONNEE";
  notes: string | null;
}

export interface PlanningData {
  lignes: PlanningLigneDTO[];
  taches: PlanningTacheDTO[];
}

/**
 * Lignes actives + tâches de la fenêtre [from, to[ + toutes les tâches EN
 * RETARD (non faites, date passée) : elles sont reportées sur le mois courant.
 */
export async function getPlanningData(ownerId: string, from: Date, to: Date): Promise<PlanningData> {
  const today = todayZurich();
  const [lignes, taches] = await Promise.all([
    prisma.planningLigne.findMany({
      where: { ownerId, actif: true },
      select: {
        id: true,
        prospectId: true,
        service: true,
        libelle: true,
        auto: true,
        fraisPubAvances: true,
        prospect: { select: { raisonSociale: true, ville: true } },
        contract: { select: { numero: true } },
        regles: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true, code: true, titre: true, frequence: true, fixe: true,
            fenetreDebut: true, fenetreFin: true, jours: true, jourSemaine: true,
            dureeMin: true, actif: true,
          },
        },
      },
    }),
    prisma.planningTache.findMany({
      where: {
        ownerId,
        ligne: { actif: true },
        OR: [
          { date: { gte: from, lt: to } },
          { date: { lt: today }, statut: { in: ["A_FAIRE", "EN_COURS", "ATTENTE_CLIENT"] } },
        ],
      },
      select: {
        id: true, ligneId: true, regleId: true, titre: true, date: true,
        dureeMin: true, statut: true, notes: true,
        regle: { select: { code: true } },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    lignes: lignes
      .map((l) => ({
        id: l.id,
        prospectId: l.prospectId,
        client: l.prospect.raisonSociale,
        ville: l.prospect.ville,
        service: l.service,
        libelle: l.libelle,
        auto: l.auto,
        fraisPubAvances: l.fraisPubAvances,
        contratNumero: l.contract?.numero ?? null,
        regles: l.regles.map((r) => ({ ...r, frequence: r.frequence })),
      }))
      .sort((a, b) => a.client.localeCompare(b.client, "fr")),
    taches: taches.map((t) => ({
      id: t.id,
      ligneId: t.ligneId,
      regleId: t.regleId,
      code: t.regle?.code ?? null,
      titre: t.titre,
      date: t.date.toISOString().slice(0, 10),
      dureeMin: t.dureeMin,
      statut: t.statut,
      notes: t.notes,
    })),
  };
}

/** Compteurs pour l'alerte du dashboard. */
export async function getPlanningAlertes(ownerId: string) {
  const today = todayZurich();
  const unMoisAvant = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, today.getUTCDate()));
  const actifs = { in: ["A_FAIRE", "EN_COURS", "ATTENTE_CLIENT"] as ("A_FAIRE" | "EN_COURS" | "ATTENTE_CLIENT")[] };
  const [aujourdhui, enRetard, critiques] = await Promise.all([
    prisma.planningTache.count({ where: { ownerId, ligne: { actif: true }, date: today, statut: actifs } }),
    prisma.planningTache.count({ where: { ownerId, ligne: { actif: true }, date: { lt: today }, statut: actifs } }),
    prisma.planningTache.count({ where: { ownerId, ligne: { actif: true }, date: { lt: unMoisAvant }, statut: actifs } }),
  ]);
  return { aujourdhui, enRetard, critiques };
}
