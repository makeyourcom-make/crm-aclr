import { ProspectsListView } from "@/components/prospects/prospects-list-view";
import { prisma } from "@/lib/db";
import { loadProspectsPage } from "@/lib/queries/prospects-pages";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Entreprises" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Liste des entreprises. Données : loadProspectsPage (RLS par
 * rôle dans chaque requête) ; présentation : ProspectsListView.
 */
export default async function ProspectsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const data = await loadProspectsPage(user, raw);
  // Compteur des fusions à valider (admin uniquement) pour le lien d'en-tête.
  const pendingMergeCount =
    user.role === "ADMIN"
      ? await prisma.prospectMerge.count({ where: { statut: "EN_ATTENTE" } })
      : 0;
  return <ProspectsListView data={data} pendingMergeCount={pendingMergeCount} />;
}
