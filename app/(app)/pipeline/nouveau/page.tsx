import Link from "next/link";

import { DealForm } from "@/components/pipeline/deal-form";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser, scopedWhere } from "@/lib/session";

export const metadata = { title: "Nouveau deal" };

export default async function NewDealPage() {
  const user = await requireUser();

  // Liste des prospects sur lesquels l'utilisateur peut créer un deal
  // (= ses prospects actifs + statuts hors SIGNE/PERDU)
  const prospects = await prisma.prospect.findMany({
    where: {
      ...scopedWhere(user, {}),
      statut: { notIn: ["SIGNE", "PERDU", "NE_PAS_RAPPELER"] },
    },
    select: { id: true, raisonSociale: true, ville: true },
    orderBy: { raisonSociale: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Nouveau deal"
        description="Crée une opportunité commerciale rattachée à un prospect existant."
        breadcrumb={
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour au pipeline
          </Link>
        }
      />
      <DealForm prospects={prospects} />
    </div>
  );
}
