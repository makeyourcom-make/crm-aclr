import { redirect } from "next/navigation";

import { TagsManager } from "@/components/prospects/tags-manager";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Tags entreprises" };
export const dynamic = "force-dynamic";

export default async function ProspectTagsPage() {
  const user = await requireUser();
  // Page admin uniquement — Sophie est redirigée
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
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Tags entreprises"
        description={`${tags.length} tag(s) défini(s). Les tags sont visibles par toute l'équipe mais gérés uniquement par l'admin.`}
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
