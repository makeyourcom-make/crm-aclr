/**
 * Chargement des données des pages de la rubrique Entreprises (liste et
 * fiche). Les pages restent minces : session + paramètres → loader → vue.
 * Les vues (components/prospects/*-view) ne font aucune requête.
 *
 * Droits : identiques aux requêtes appelées (RLS commercial via
 * getProspects / getProspectById / getProspectActivities…).
 */
import { getPlayerStats } from "@/lib/gamification";
import type { DailyGoal } from "@/lib/gamification/rules";
import { prisma } from "@/lib/db";
import { getProspectActivities } from "@/lib/queries/activities";
import { getDossiersForProspect } from "@/lib/queries/dossiers";
import {
  getLeadsOverview,
  getProspectById,
  getProspects,
  getProspectStats,
} from "@/lib/queries/prospects";
import { ProspectListParamsSchema } from "@/lib/schemas/prospect";
import type { SessionUser } from "@/lib/session";
import {
  parseFraicheur,
  parseVue,
} from "@/components/prospects/lead-views";

type RawParams = Record<string, string | string[] | undefined>;

/** Objectifs du jour (appels, RDV pris) : ne doivent jamais casser la liste. */
async function loadPlayer(
  userId: string,
): Promise<{ goalAppels: DailyGoal | null; goalRdv: DailyGoal | null }> {
  try {
    const stats = await getPlayerStats(userId);
    return {
      goalAppels: stats.dailyGoals.find((g) => g.key === "appels") ?? null,
      goalRdv: stats.dailyGoals.find((g) => g.key === "rdvPris") ?? null,
    };
  } catch (err) {
    console.error("[resultats] getPlayerStats a échoué :", err);
    return { goalAppels: null, goalRdv: null };
  }
}

/** Données de la liste /prospects (tout part en parallèle). */
export async function loadProspectsPage(
  user: SessionUser,
  raw: RawParams,
  now: Date = new Date(),
) {
  // Parse + valeurs par défaut. Ignore les params inconnus / mal formés.
  const params = ProspectListParamsSchema.parse(raw);
  // Vues rapides et fraîcheur : paramètres en plus du schéma.
  const vue = parseVue(raw.vue);
  const fraicheur = parseFraicheur(raw.fraicheur);

  // Tri par défaut adapté à la vue (si aucun tri explicite dans l'URL).
  if (!raw.sortBy) {
    if (vue === "rdv") {
      params.sortBy = "dateRdvLe";
      params.sortDir = "asc";
    } else if (vue === "chaudes" || vue === "refroidit" || vue === "relancer") {
      params.sortBy = "derniereActionLe";
      params.sortDir = vue === "chaudes" ? "desc" : "asc";
    }
  }

  const isAdmin = user.role === "ADMIN";

  const [list, stats, overview, teamUsers, tags, products, player] =
    await Promise.all([
      getProspects(user, params, { vue, fraicheur, now }),
      getProspectStats(user, isAdmin ? params.assigneAId : undefined),
      getLeadsOverview(user, {
        assigneAId: isAdmin ? params.assigneAId : undefined,
        now,
      }),
      isAdmin
        ? prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([] as Array<{ id: string; name: string }>),
      prisma.prospectTag.findMany({
        select: { id: true, nom: true },
        orderBy: { nom: "asc" },
      }),
      // Produits réellement présents dans au moins un contrat (inutile de
      // proposer un produit que personne n'a). Sert au filtre « Produit ».
      prisma.product.findMany({
        where: { contracts: { some: {} } },
        select: { id: true, nom: true },
        orderBy: { nom: "asc" },
      }),
      loadPlayer(user.id),
    ]);

  return {
    user: { id: user.id, role: user.role },
    raw,
    params,
    vue,
    fraicheur,
    nowMs: now.getTime(),
    list,
    stats,
    overview,
    teamUsers,
    tags,
    products,
    player,
  };
}

export type ProspectsPageData = Awaited<ReturnType<typeof loadProspectsPage>>;

/** Données de la fiche /prospects/[id] ; null si introuvable ou inaccessible. */
export async function loadProspectFiche(user: SessionUser, id: string) {
  const [
    prospect,
    activities,
    emailTemplates,
    allTags,
    emailSignatures,
    contracts,
    clientInvoices,
    dossiers,
    deals,
  ] = await Promise.all([
    getProspectById(user, id),
    getProspectActivities(id, user),
    prisma.emailTemplate.findMany({
      select: { id: true, nom: true, objet: true, contenu: true },
      orderBy: { nom: "asc" },
    }),
    prisma.prospectTag.findMany({
      select: { id: true, nom: true, couleur: true },
      orderBy: { nom: "asc" },
    }),
    prisma.emailSignature.findMany({
      where: { userId: user.id },
      select: { id: true, nom: true, html: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { nom: "asc" }],
    }),
    prisma.contract.findMany({
      where: { prospectId: id },
      select: {
        id: true,
        numero: true,
        statut: true,
        dateDebut: true,
        dureeMois: true,
        reconductible: true,
        devise: true,
        montantOneShot: true,
        montantMensuel: true,
        valeurAn1: true,
        dealId: true,
      },
      orderBy: { dateDebut: "desc" },
    }),
    prisma.clientInvoice.findMany({
      where: { contract: { prospectId: id } },
      select: {
        id: true,
        numero: true,
        type: true,
        statut: true,
        total: true,
        devise: true,
        dateEmission: true,
        dateEcheance: true,
      },
      orderBy: { dateEmission: "desc" },
    }),
    getDossiersForProspect(user, id),
    // Deals de la fiche (pipeline). Rien n'est renvoyé si la fiche n'est pas
    // visible pour l'utilisateur (contrôle ci-dessous).
    prisma.deal.findMany({
      where: { prospectId: id },
      select: {
        id: true,
        titre: true,
        stage: true,
        montantPrevu: true,
        probabilite: true,
        closeAttenduLe: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Row-level security : getProspectById renvoie null si la fiche n'est pas
  // accessible ; on ne renvoie alors AUCUNE des données chargées en parallèle.
  if (!prospect) return null;

  return {
    /** Horloge de référence du rendu (chaleur, fraîcheur, à venir / passé). */
    nowMs: Date.now(),
    prospect,
    activities,
    emailTemplates,
    allTags,
    emailSignatures,
    contracts,
    clientInvoices,
    dossiers,
    deals,
  };
}

export type ProspectFicheData = NonNullable<Awaited<ReturnType<typeof loadProspectFiche>>>;
