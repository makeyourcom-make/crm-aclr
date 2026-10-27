import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { ProspectImportWizard } from "@/components/prospects/prospect-import-wizard";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Import de prospects" };

export default async function ImportProspectsPage() {
  // RBAC : import réservé à l'admin (Sophie ne doit pas pouvoir injecter
  // ou modifier en masse des données).
  await requireAdmin();

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="leads"
        title="Importer des entreprises"
        description="Charge un fichier CSV exporté de LinkedIn Sales Nav, d'un fichier communal, ou de n'importe quelle source. Le mapping des colonnes est détecté automatiquement."
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
      <ProspectImportWizard />
    </div>
  );
}
