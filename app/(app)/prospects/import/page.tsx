import Link from "next/link";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { ProspectImportWizard } from "@/components/prospects/prospect-import-wizard";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Import de prospects" };

export default async function ImportProspectsPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Importer des prospects"
        description="Charge un fichier CSV exporté de LinkedIn Sales Nav, d'un fichier communal, ou de n'importe quelle source. Le mapping des colonnes est détecté automatiquement."
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
      <ProspectImportWizard />
    </div>
  );
}
