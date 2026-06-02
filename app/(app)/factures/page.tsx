import { GenerateInvoiceButton } from "@/components/factures/invoice-actions";
import { InvoicesTable } from "@/components/factures/invoices-table";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/db";
import { formatCHF } from "@/lib/format";
import { getInvoices, getInvoiceStats } from "@/lib/queries/invoices";
import { InvoiceListParamsSchema } from "@/lib/schemas/invoice";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Salaires" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FacturesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const params = InvoiceListParamsSchema.parse(raw);

  const [{ items, total, page, pageSize, totalPages }, stats, users] =
    await Promise.all([
      getInvoices(user, params),
      getInvoiceStats(user),
      user.role === "ADMIN"
        ? prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const aPayer = stats.byStatut.ENVOYEE;
  const enBrouillon = stats.byStatut.BROUILLON;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title={user.role === "ADMIN" ? "Salaires commerciales" : "Mes salaires"}
        description={
          user.role === "ADMIN"
            ? "Salaires mensuels versés aux commerciales (commissions + garantie + frais)."
            : "Tes fiches de salaire mensuelles. Pour le détail des commissions acquises, va dans l'onglet « Commissions »."
        }
        actions={
          user.role === "ADMIN" && users.length > 0 ? (
            <GenerateInvoiceButton users={users} />
          ) : null
        }
      />

      {/* KPIs — visibles uniquement côté admin (Sophie a déjà ces infos dans /commissions) */}
      {user.role === "ADMIN" && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total versé YTD
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
                {formatCHF(stats.ytdTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                dont {formatCHF(stats.ytdCommissions)} de commissions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                En attente de paiement
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatCHF(Number(aPayer?._sum.montantTotal ?? 0))}
              </p>
              <p className="text-xs text-muted-foreground">
                {aPayer?._count ?? 0} facture(s) envoyée(s)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Brouillons
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatCHF(Number(enBrouillon?._sum.montantTotal ?? 0))}
              </p>
              <p className="text-xs text-muted-foreground">
                {enBrouillon?._count ?? 0} à envoyer
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <InvoicesTable
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
