import Link from "next/link";

import { ContractsTable } from "@/components/contrats/contracts-table";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { formatCHF } from "@/lib/format";
import { getContracts, getContractStats } from "@/lib/queries/contracts";
import { ContractListParamsSchema } from "@/lib/schemas/contract";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Contrats" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContractsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const params = ContractListParamsSchema.parse(raw);

  const [{ items, total, page, pageSize, totalPages }, stats] =
    await Promise.all([
      getContracts(user, params),
      getContractStats(user),
    ]);

  const nbActifs = stats.byStatut.ACTIF ?? 0;

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Contrats"
        description={`${nbActifs} contrat(s) actif(s) sur ${stats.total} total.`}
        actions={
          <Link
            href="/contrats/nouveau"
            className={buttonVariants({ variant: "default" })}
          >
            <Icon name="FileText" className="mr-1.5 h-4 w-4" />
            Nouveau contrat
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Valeur an 1 active
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCHF(stats.valeurAn1Active)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              CA mensuel récurrent
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCHF(stats.mensuelActif)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / mois
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              CA récurrent annualisé
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCHF(stats.mensuelActif * 12)}
            </p>
          </CardContent>
        </Card>
      </div>

      <ContractsTable
        rows={items}
        showCommerciale={user.role === "ADMIN"}
      />

      <div className="mt-4">
        <Pagination
          current={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
        />
      </div>
    </div>
  );
}
