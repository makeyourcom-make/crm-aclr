import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { ProspectForm } from "@/components/prospects/prospect-form";
import { createProspectRaw } from "@/app/(app)/prospects/actions";
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
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="leads"
        title="Nouvelle entreprise"
        description="Saisis manuellement une entreprise (prospect ou client). Pour importer en masse, utilise plutôt l'import CSV."
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
      <ProspectForm
        action={action}
        teamUsers={teamUsers}
        isAdmin={isAdmin}
      />
    </div>
  );
}
