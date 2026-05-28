import { PaymentsTable } from "@/components/paiements/payments-table";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { formatCHF } from "@/lib/format";
import { getPayments, getPaymentStats } from "@/lib/queries/payments";
import { PaymentListParamsSchema } from "@/lib/schemas/payment";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Paiements clients" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const user = await requireAdmin();
  const raw = await searchParams;
  const params = PaymentListParamsSchema.parse(raw);

  const [{ items, total, page, pageSize, totalPages }, stats] =
    await Promise.all([getPayments(user, params), getPaymentStats(user)]);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Paiements clients"
        description="Encaissements reçus des clients signés. L'encaissement déclenche automatiquement les versements de commissions correspondants."
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Encaissés ce mois
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
              {formatCHF(stats.encaisseesMois.montant)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.encaisseesMois.count} paiement(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              En attente
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCHF(stats.enAttente.montant)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.enAttente.count} paiement(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              En retard
            </p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${stats.enRetard.count > 0 ? "text-red-700" : ""}`}
            >
              {formatCHF(stats.enRetard.montant)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.enRetard.count} paiement(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <PaymentsTable
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

      <p className="mt-6 text-xs text-muted-foreground">
        💡 Pour enregistrer un paiement, va sur la fiche d&apos;un contrat et
        clique « Enregistrer un paiement ». Le statut « Encaisser » sur cette
        liste sert pour les paiements déjà créés en attente.
      </p>
    </div>
  );
}
