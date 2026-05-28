import Link from "next/link";
import { notFound } from "next/navigation";

import { ContractStatutBadge } from "@/components/contrats/contract-statut-badge";
import { ResilierButton } from "@/components/contrats/resilier-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatDate, formatDateLong } from "@/lib/format";
import { getContractById } from "@/lib/queries/contracts";
import { requireUser } from "@/lib/session";

import type { CommissionPaymentTypePart } from "@prisma/client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Contrat ${id.slice(0, 8)}…` };
}

const TYPE_PART_LABEL: Record<CommissionPaymentTypePart, string> = {
  SIGNATURE: "Signature",
  ETALEMENT: "Étalement",
  RENOUVELLEMENT: "Renouvellement",
};

const PAY_STATUT_BADGE: Record<string, string> = {
  PREVU: "bg-slate-100 text-slate-600",
  PAYE: "bg-emerald-100 text-emerald-700",
  ANNULE: "bg-red-100 text-red-700",
};

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

export default async function ContractDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const contract = await getContractById(user, id);

  if (!contract) notFound();

  const commission = contract.commissions[0]; // 1 commission par contrat

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 lg:px-8">
      <PageHeader
        title={contract.numero}
        description={contract.prospect.raisonSociale}
        breadcrumb={
          <Link
            href="/contrats"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux contrats
          </Link>
        }
        actions={
          contract.statut === "ACTIF" ? (
            <ResilierButton contractId={contract.id} />
          ) : null
        }
      />

      {/* Statut + montants */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ContractStatutBadge statut={contract.statut} />
        <span className="text-xs text-muted-foreground">
          Signé le {formatDateLong(contract.dateSignature)}
        </span>
        <span className="text-xs text-muted-foreground">
          · {contract.dureeMois} mois
        </span>
        {contract.dateResiliation && (
          <span className="text-xs text-red-600">
            · Résilié le {formatDate(contract.dateResiliation)}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          label="Valeur an 1"
          value={formatCHF(Number(contract.valeurAn1))}
        />
        <Kpi
          label="One-shot"
          value={formatCHF(Number(contract.montantOneShot))}
        />
        <Kpi
          label="Mensuel récurrent"
          value={`${formatCHF(Number(contract.montantMensuel))} / mois`}
        />
      </div>

      {/* Infos générales */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Infos générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Field label="Commerciale">{contract.assigneA.name}</Field>
          <Field label="Modalité de paiement">
            {contract.modalitePaiement.replace(/_/g, " ")}
          </Field>
          <Field label="Date de début">
            {formatDateLong(contract.dateDebut)}
          </Field>
          <Field label="Échéance">
            {formatDateLong(
              new Date(
                contract.dateDebut.getFullYear(),
                contract.dateDebut.getMonth() + contract.dureeMois,
                contract.dateDebut.getDate(),
              ),
            )}
          </Field>
          {contract.deal && (
            <Field label="Deal d'origine" className="sm:col-span-2">
              <Link
                href="/pipeline"
                className="text-primary hover:underline"
              >
                {contract.deal.titre}
              </Link>
            </Field>
          )}
          {contract.raisonResiliation && (
            <Field
              label="Raison de résiliation"
              className="sm:col-span-2"
            >
              <p className="rounded-md bg-red-50 px-3 py-2 text-red-700">
                {contract.raisonResiliation}
              </p>
            </Field>
          )}
        </CardContent>
      </Card>

      {/* Produits du contrat */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Produits ({contract.products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contract.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun produit lié.</p>
          ) : (
            <ul className="space-y-1.5">
              {contract.products.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <span>{p.nom}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {p.prixOneShot &&
                      `${formatCHF(Number(p.prixOneShot))} one-shot`}
                    {p.prixOneShot && p.prixMensuel && " · "}
                    {p.prixMensuel &&
                      `${formatCHF(Number(p.prixMensuel))}/mois`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Factures clients */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Factures clients ({contract.clientInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left">
              <tr>
                <Th>N°</Th>
                <Th>Émise le</Th>
                <Th>Échéance</Th>
                <Th>Type</Th>
                <Th className="text-right">Total</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {contract.clientInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                    Aucune facture.
                  </td>
                </tr>
              ) : (
                contract.clientInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {inv.numero}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatDate(inv.dateEmission)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatDate(inv.dateEcheance)}
                    </td>
                    <td className="px-3 py-2 text-xs">{inv.type}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCHF(Number(inv.total))}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="secondary"
                        className={`font-normal ${CLIENT_INV_BADGE[inv.statut] ?? ""}`}
                      >
                        {CLIENT_INV_LABEL[inv.statut] ?? inv.statut}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Planning commissions */}
      {commission && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              Planning commissions ({commission.payments.length})
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Total {formatCHF(Number(commission.montantTotal))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left">
                <tr>
                  <Th>Type</Th>
                  <Th>Mois</Th>
                  <Th>Date prévue</Th>
                  <Th className="text-right">Montant</Th>
                  <Th>Statut</Th>
                  <Th>Versé le</Th>
                </tr>
              </thead>
              <tbody>
                {commission.payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-2 text-xs">
                      {TYPE_PART_LABEL[p.typePart]}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {p.numeroMois ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatDate(p.dateVersementPrevue)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCHF(Number(p.montant))}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="secondary"
                        className={`font-normal ${PAY_STATUT_BADGE[p.statut] ?? ""}`}
                      >
                        {p.statut}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.dateVersement ? formatDate(p.dateVersement) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-foreground">{children}</div>
    </div>
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
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
