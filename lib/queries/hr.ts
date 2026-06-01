/**
 * Requêtes pour le module RH.
 *
 * Toutes les fonctions exigent un user ADMIN — la vérification est faite
 * côté page via requireAdmin(). On ne re-vérifie pas ici pour éviter le
 * bruit, mais aucune fonction n'est exposée hors d'une page protégée.
 */
import { prisma } from "@/lib/db";

export async function listEmployees() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      typeContrat: true,
      dateEntree: true,
      dateSortie: true,
      pourcentageActivite: true,
      salaireBase: true,
      garantieMensuelle: true,
      tauxCommissionSignature: true,
      _count: { select: { documentsRH: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getEmployeeById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      documentsRH: { orderBy: { createdAt: "desc" } },
      _count: {
        select: {
          prospectsAssignes: true,
          dealsAssignes: true,
          contratsAssignes: true,
        },
      },
    },
  });
}
