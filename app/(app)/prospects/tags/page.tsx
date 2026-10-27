import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TagsManager } from "@/components/prospects/tags-manager";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Tags entreprises" };
export const dynamic = "force-dynamic";

export default async function ProspectTagsPage() {
  const user = await requireUser();
  // Page admin uniquement : la commerciale est redirigée
  if (user.role !== "ADMIN") {
    redirect("/prospects");
  }

  const tags = await prisma.prospectTag.findMany({
    orderBy: { nom: "asc" },
    include: {
      _count: { select: { prospects: true } },
    },
  });

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="leads"
        title="Tags entreprises"
        description={`${tags.length} tag(s) défini(s). Les tags sont visibles par toute l'équipe mais gérés uniquement par l'admin.`}
        breadcrumb={
          <Link
            href="/prospects"
            className="inline-flex h-9 items-center gap-1 rounded-[10px] pr-2.5 pl-1.5 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Retour aux entreprises
          </Link>
        }
      />

      <TagsManager
        tags={tags.map((t) => ({
          id: t.id,
          nom: t.nom,
          couleur: t.couleur,
          description: t.description,
          nbProspects: t._count.prospects,
        }))}
      />
    </div>
  );
}
