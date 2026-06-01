import Link from "next/link";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PipelineViewSwitcher } from "@/components/pipeline/pipeline-view-switcher";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatCHF } from "@/lib/format";
import { getPipeline } from "@/lib/queries/deals";
import { DealListParamsSchema } from "@/lib/schemas/deal";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PipelinePage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const isAdmin = user.role === "ADMIN";

  // Côté admin : défaut "Toute l'équipe" (vue de pilotage globale).
  // Le switcher permet de filtrer sur Sophie, Arthur, etc.
  // Côté commercial : RLS appliquée côté query, ce param est ignoré.
  const explicitAssigneAId =
    typeof raw.assigneAId === "string" ? raw.assigneAId : undefined;
  const effectiveAssigneAId = isAdmin ? explicitAssigneAId : undefined;

  const params = DealListParamsSchema.parse({
    ...raw,
    assigneAId: effectiveAssigneAId ?? raw.assigneAId,
  });

  const [pipeline, teamUsers] = await Promise.all([
    getPipeline(user, params),
    isAdmin
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Libellé selon la vue active
  const viewedUser =
    effectiveAssigneAId && effectiveAssigneAId !== user.id
      ? teamUsers.find((u) => u.id === effectiveAssigneAId)
      : null;
  const viewLabel = isAdmin
    ? !effectiveAssigneAId
      ? "Toute l'équipe"
      : viewedUser
        ? `Pipeline de ${viewedUser.name}`
        : "Mon pipeline"
    : "Mon pipeline";

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Pipeline"
        description={`${viewLabel} · total ${formatCHF(pipeline.grandTotal)} · pondéré ${formatCHF(pipeline.grandTotalPondere)}`}
        actions={
          <Link
            href="/pipeline/nouveau"
            className={buttonVariants({ variant: "default" })}
          >
            <Icon name="GitBranch" className="mr-1.5 h-4 w-4" />
            Nouveau deal
          </Link>
        }
      />

      {isAdmin && teamUsers.length > 1 && (
        <div className="mb-4">
          <PipelineViewSwitcher
            users={teamUsers}
            currentUserId={user.id}
            activeAssigneAId={effectiveAssigneAId}
          />
        </div>
      )}

      <PipelineBoard initialData={pipeline} isAdmin={isAdmin} />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        💡 Glisse une carte d&apos;une colonne à l&apos;autre pour changer son stage —
        la probabilité par défaut est mise à jour automatiquement.
        {isAdmin && (
          <>
            <br />
            🗑️ La colonne <strong>Perdu</strong> est réinitialisée à 0 chaque
            mois : seules les pertes du mois courant restent visibles.
          </>
        )}
      </p>
    </div>
  );
}
