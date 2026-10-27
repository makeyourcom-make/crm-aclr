import { notFound } from "next/navigation";

import { ProspectFicheView } from "@/components/prospects/prospect-fiche-view";
import { loadProspectFiche } from "@/lib/queries/prospects-pages";
import { requireUser } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Prospect ${id.slice(0, 8)}` };
}

/**
 * Fiche entreprise. Données : loadProspectFiche (null si la fiche n'existe
 * pas ou n'est pas accessible : RLS commercial) ; présentation :
 * ProspectFicheView.
 */
export default async function ProspectDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const data = await loadProspectFiche(user, id);
  if (!data) notFound();
  return (
    <ProspectFicheView
      data={data}
      user={{ id: user.id, role: user.role }}
      nowMs={data.nowMs}
    />
  );
}
