"use server";

/**
 * Recherche globale (palette ⌘K) : entreprises, deals, contrats.
 * Scopée par la RLS (commerciale = ses fiches, admin = tout).
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export interface GlobalSearchResults {
  prospects: { id: string; raisonSociale: string; ville: string | null }[];
  deals: { id: string; titre: string; prospectId: string; prospect: string }[];
  contracts: { id: string; numero: string; prospect: string }[];
}

const EMPTY: GlobalSearchResults = { prospects: [], deals: [], contracts: [] };

export interface ProspectPickerResult {
  id: string;
  raisonSociale: string;
  ville: string | null;
}

/** Recherche de prospects pour un sélecteur (combobox) — scopée RLS. */
export async function searchProspects(
  q: string,
): Promise<ProspectPickerResult[]> {
  try {
    const user = await requireUser();
    const term = q.trim();
    if (term.length < 1) return [];
    const mine = user.role !== "ADMIN" ? { assigneAId: user.id } : {};
    const ci = (s: string) => ({ contains: s, mode: "insensitive" as const });
    return await prisma.prospect.findMany({
      where: {
        ...mine,
        OR: [
          { raisonSociale: ci(term) },
          { ville: ci(term) },
          { email: ci(term) },
          { contactNom: ci(term) },
        ],
      },
      select: { id: true, raisonSociale: true, ville: true },
      take: 20,
      orderBy: { raisonSociale: "asc" },
    });
  } catch {
    return [];
  }
}

export async function globalSearch(q: string): Promise<GlobalSearchResults> {
  // Tout est enveloppé : la recherche ne doit JAMAIS planter la page.
  try {
    const user = await requireUser();
    const term = q.trim();
    if (term.length < 2) return EMPTY;

    const mine = user.role !== "ADMIN" ? { assigneAId: user.id } : {};
    const ci = (s: string) => ({ contains: s, mode: "insensitive" as const });

    const [prospects, deals, contracts] = await Promise.all([
      prisma.prospect.findMany({
        where: {
          ...mine,
          OR: [
            { raisonSociale: ci(term) },
            { contactNom: ci(term) },
            { email: ci(term) },
            { ville: ci(term) },
            { telephone: ci(term) },
          ],
        },
        select: { id: true, raisonSociale: true, ville: true },
        take: 8,
        orderBy: { raisonSociale: "asc" },
      }),
      prisma.deal.findMany({
        where: {
          ...mine,
          OR: [{ titre: ci(term) }, { prospect: { raisonSociale: ci(term) } }],
        },
        select: {
          id: true,
          titre: true,
          prospectId: true,
          prospect: { select: { raisonSociale: true } },
        },
        take: 6,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.contract.findMany({
        where: {
          ...mine,
          OR: [{ numero: ci(term) }, { prospect: { raisonSociale: ci(term) } }],
        },
        select: {
          id: true,
          numero: true,
          prospect: { select: { raisonSociale: true } },
        },
        take: 6,
        orderBy: { dateDebut: "desc" },
      }),
    ]);

    return {
      prospects,
      deals: deals.map((d) => ({
        id: d.id,
        titre: d.titre,
        prospectId: d.prospectId,
        prospect: d.prospect.raisonSociale,
      })),
      contracts: contracts.map((c) => ({
        id: c.id,
        numero: c.numero,
        prospect: c.prospect.raisonSociale,
      })),
    };
  } catch {
    return EMPTY;
  }
}
