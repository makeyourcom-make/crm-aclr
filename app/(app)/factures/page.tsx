import { CircleCheck, FilePen, Send } from "lucide-react";

import { StatTile } from "@/components/arena/stat-tile";
import { ChfValue } from "@/components/common/chf-value";
import { PageShell } from "@/components/common/page-shell";
import { GenerateInvoiceButton } from "@/components/factures/invoice-actions";
import { InvoicesTable } from "@/components/factures/invoices-table";
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
    <PageShell>
      <PageHeader
        rubrique="finance"
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

      {/* KPIs : visibles uniquement côté admin (la commerciale a déjà ces infos dans /commissions) */}
      {user.role === "ADMIN" && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Total versé YTD"
            value={<ChfValue amount={stats.ytdTotal} />}
            sub={`dont ${formatCHF(stats.ytdCommissions)} de commissions`}
            tone="green"
            icon={CircleCheck}
          />
          <StatTile
            label="En attente de paiement"
            value={<ChfValue amount={Number(aPayer?._sum.montantTotal ?? 0)} />}
            sub={`${aPayer?._count ?? 0} facture(s) envoyée(s)`}
            tone="gold"
            icon={Send}
          />
          <StatTile
            label="Brouillons"
            value={<ChfValue amount={Number(enBrouillon?._sum.montantTotal ?? 0)} />}
            sub={`${enBrouillon?._count ?? 0} à envoyer`}
            tone="navy"
            icon={FilePen}
          />
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
    </PageShell>
  );
}
