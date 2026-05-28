import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { ProspectFilters } from "@/components/prospects/prospect-filters";
import { ProspectsTable } from "@/components/prospects/prospects-table";
import {
  getProspects,
  getProspectStats,
} from "@/lib/queries/prospects";
import { ProspectListParamsSchema } from "@/lib/schemas/prospect";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Prospects" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProspectsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;

  // Parse + valeurs par défaut. Ignore les params inconnus / mal formés.
  const params = ProspectListParamsSchema.parse(raw);

  const [{ items, total, page, pageSize, totalPages }, stats] =
    await Promise.all([getProspects(user, params), getProspectStats(user)]);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Prospects"
        description={
          stats.nbSignes > 0
            ? `${stats.nbActifs} prospect(s) en cours de prospection — ${stats.nbSignes} déjà signé(s) (voir /contrats).`
            : `${stats.nbActifs} prospect(s) en cours de prospection.`
        }
        actions={
          <>
            <Link
              href="/prospects/import"
              className={buttonVariants({ variant: "outline" })}
            >
              <Icon name="FileSpreadsheet" className="mr-1.5 h-4 w-4" />
              Importer CSV
            </Link>
            <Link
              href="/prospects/nouveau"
              className={buttonVariants({ variant: "default" })}
            >
              <Icon name="Users" className="mr-1.5 h-4 w-4" />
              Nouveau prospect
            </Link>
          </>
        }
      />

      <div className="mb-4">
        <ProspectFilters params={params} />
      </div>

      <ProspectsTable rows={items} />

      <div className="mt-4">
        <Pagination
          current={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
        />
      </div>

      {/* Lien rapide vers les signés si pas déjà filtré */}
      {stats.nbSignes > 0 && !params.statut && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {stats.nbSignes} prospect(s) signé(s) sont masqué(s) de cette liste.{" "}
          <Link
            href="/prospects?statut=SIGNE"
            className="underline-offset-2 hover:underline text-foreground"
          >
            Les afficher quand même →
          </Link>
        </p>
      )}
    </div>
  );
}
