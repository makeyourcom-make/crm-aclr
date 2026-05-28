import Link from "next/link";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { buttonVariants } from "@/components/ui/button";
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
  const params = DealListParamsSchema.parse(raw);
  const pipeline = await getPipeline(user, params);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Pipeline"
        description={`Pipeline total : ${formatCHF(pipeline.grandTotal)} · pondéré ${formatCHF(pipeline.grandTotalPondere)}`}
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

      <PipelineBoard
        initialData={pipeline}
        isAdmin={user.role === "ADMIN"}
      />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        💡 Glisse une carte d&apos;une colonne à l&apos;autre pour changer son stage —
        la probabilité par défaut est mise à jour automatiquement.
      </p>
    </div>
  );
}
