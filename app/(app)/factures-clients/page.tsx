import Link from "next/link";

import { MarkInvoicePaidButton } from "@/components/paiements/mark-invoice-paid-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatCHF, formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Factures clients" };
export const dynamic = "force-dynamic";

const CLIENT_INV_BADGE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600",
  ENVOYEE: "bg-blue-100 text-blue-700",
  PAYEE: "bg-emerald-100 text-emerald-700",
  EN_RETARD: "bg-red-100 text-red-700",
  ANNULEE: "bg-slate-100 text-slate-400",
};
const CLIENT_INV_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FacturesClientsPage({ searchParams }: PageProps) {
  const user = await requireAdmin();
  const raw = await searchParams;
  const filterStatut = typeof raw.statut === "string" ? raw.statut : undefined;
  const now = new Date();

  const where = {
    ...(user.role === "ADMIN" ? {} : { contract: { assigneAId: user.id } }),
    ...(filterStatut ? { statut: filterStatut as never } : {}),
  };

  const [invoices, stats] = await Promise.all([
    prisma.clientInvoice.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            numero: true,
            assigneAId: true,
            prospect: { select: { id: true, raisonSociale: true } },
          },
        },
      },
      orderBy: [{ dateEmission: "desc" }],
      take: 200,
    }),
    prisma.clientInvoice.groupBy({
      by: ["statut"],
      where: user.role === "ADMIN" ? {} : { contract: { assigneAId: user.id } },
      _count: true,
      _sum: { total: true },
    }),
  ]);

  // Marque automatiquement en retard les ENVOYEE dont dateEcheance < now (visuel)
  const enriched = invoices.map((inv) => {
    const isOverdue =
      inv.statut === "ENVOYEE" && inv.dateEcheance < now;
    return { ...inv, isOverdue };
  });

  const byStatut = Object.fromEntries(stats.map((s) => [s.statut, s]));
  const totalPayees = Number(byStatut.PAYEE?._sum.total ?? 0);
  const totalEnvoyees = Number(byStatut.ENVOYEE?._sum.total ?? 0);
  const nbEnRetard = enriched.filter((i) => i.isOverdue).length;
  const totalEnRetard = enriched
    .filter((i) => i.isOverdue)
    .reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Factures clients"
        description={`${invoices.length} facture(s) émise(s) par ACLR Sàrl. Génération automatique à la signature et à chaque renouvellement.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Kpi
          label="Encaissé"
          value={formatCHF(totalPayees)}
          subtitle={`${byStatut.PAYEE?._count ?? 0} facture(s)`}
          tone="emerald"
        />
        <Kpi
          label="En attente paiement"
          value={formatCHF(totalEnvoyees)}
          subtitle={`${byStatut.ENVOYEE?._count ?? 0} envoyée(s)`}
        />
        <Kpi
          label="En retard"
          value={formatCHF(totalEnRetard)}
          subtitle={`${nbEnRetard} facture(s)`}
          tone={nbEnRetard > 0 ? "red" : undefined}
        />
        <Kpi
          label="Brouillons"
          value={`${byStatut.BROUILLON?._count ?? 0}`}
          subtitle="à envoyer"
        />
      </div>

      {/* Filtres rapides */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link
          href="/factures-clients"
          className={`rounded-md border border-border px-2.5 py-1 ${!filterStatut ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
        >
          Toutes
        </Link>
        {(["BROUILLON", "ENVOYEE", "PAYEE", "EN_RETARD"] as const).map((s) => (
          <Link
            key={s}
            href={`/factures-clients?statut=${s}`}
            className={`rounded-md border border-border px-2.5 py-1 ${filterStatut === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
          >
            {CLIENT_INV_LABEL[s]}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <Th>N°</Th>
                  <Th>Émise le</Th>
                  <Th>Échéance</Th>
                  <Th>Client</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Statut</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {enriched.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-12 text-center text-muted-foreground"
                    >
                      Aucune facture pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  enriched.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 ${inv.isOverdue ? "bg-red-50/40" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        <a
                          href={`/api/factures-clients/${inv.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {inv.numero}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {formatDate(inv.dateEmission)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {formatDate(inv.dateEcheance)}
                        {inv.isOverdue && (
                          <span className="ml-1 text-red-600 font-semibold">
                            !
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/prospects/${inv.contract.prospect.id}`}
                          className="text-sm hover:underline"
                        >
                          {inv.contract.prospect.raisonSociale}
                        </Link>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {inv.contract.numero}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs">{inv.type}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatCHF(Number(inv.total))}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="secondary"
                          className={`font-normal ${CLIENT_INV_BADGE[inv.statut]}`}
                        >
                          {inv.isOverdue ? "En retard" : CLIENT_INV_LABEL[inv.statut]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/api/factures-clients/${inv.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-6 items-center rounded-md border border-border bg-background px-2 text-[11px] hover:bg-muted"
                          >
                            <Icon name="Receipt" className="mr-1 h-3 w-3" />
                            PDF
                          </a>
                          {(inv.statut === "BROUILLON" ||
                            inv.statut === "ENVOYEE") && (
                            <MarkInvoicePaidButton invoiceId={inv.id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        💡 Les factures sont générées automatiquement à la signature d&apos;un
        contrat selon sa modalité de paiement, et à chaque anniversaire pour
        l&apos;année renouvelée. Marque-les payées au moment de
        l&apos;encaissement.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "emerald" | "red";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-red-700" : ""}`}
        >
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
