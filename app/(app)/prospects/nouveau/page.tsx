import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { ProspectForm } from "@/components/prospects/prospect-form";
import { createProspectRaw } from "@/app/(app)/prospects/actions";
import { Icon } from "@/components/icon";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Nouvelle entreprise" };

export default async function NewProspectPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const teamUsers = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  async function action(input: unknown) {
    "use server";
    return createProspectRaw(input);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Nouvelle entreprise"
        description="Saisis manuellement une entreprise (prospect ou client). Pour importer en masse, utilise plutôt l'import CSV."
        breadcrumb={
          <Link
            href="/prospects"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux entreprises
          </Link>
        }
      />
      <ProspectForm
        action={action}
        teamUsers={teamUsers}
        isAdmin={isAdmin}
      />
    </div>
  );
}
