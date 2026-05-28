import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { ProspectForm } from "@/components/prospects/prospect-form";
import { createProspectRaw } from "@/app/(app)/prospects/actions";
import { Icon } from "@/components/icon";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Nouveau prospect" };

export default async function NewProspectPage() {
  await requireUser();

  async function action(input: unknown) {
    "use server";
    return createProspectRaw(input);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Nouveau prospect"
        description="Saisis manuellement une entreprise à prospecter. Pour importer en masse, utilise plutôt l'import CSV."
        breadcrumb={
          <Link
            href="/prospects"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux prospects
          </Link>
        }
      />
      <ProspectForm action={action} />
    </div>
  );
}
