import Link from "next/link";
import { notFound } from "next/navigation";

import { RecomputeButton } from "@/components/commissions/recompute-button";
import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { ContractStatutBadge } from "@/components/contrats/contract-statut-badge";
import { ResilierButton } from "@/components/contrats/resilier-button";
import { MarkInvoicePaidButton } from "@/components/paiements/mark-invoice-paid-button";
import { PaymentStatutBadge } from "@/components/paiements/payment-statut-badge";
import { RecordPaymentButton } from "@/components/paiements/record-payment-button";
import { ProjectMarginBox } from "@/components/contrats/project-margin-box";
import { SignAclrButton } from "@/components/signatures/sign-aclr-button";
import { SignInPersonButton } from "@/components/signatures/sign-in-person-button";
import { UploadSignedPdfButton } from "@/components/contrats/upload-signed-pdf-button";
import { getProjectMarginForContract } from "@/lib/queries/project-profitability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { getNextRenewalDate, relativeDays } from "@/lib/contract-renewal";
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

const COMMISSION_STATUT_LABEL: Record<string, string> = {
  PREVU: "À venir",
  PAYE: "Acquise",
  ANNULE: "Annulée",
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

  // Rentabilité projet — admin only
  const [margin, settingsForMargin] =
    user.role === "ADMIN"
      ? await Promise.all([
          getProjectMarginForContract(id),
          import("@/lib/db").then(({ prisma }) =>
            prisma.setting.findFirst({
              select: { tauxImpotsProvisionne: true },
            }),
          ),
        ])
      : [null, null];
  const tauxImpotsProvisionne = settingsForMargin
    ? Number(settingsForMargin.tauxImpotsProvisionne)
    : 0.25;

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
          <>
            <DocumentPreviewButton
              url={`/api/contrats/${contract.id}/pdf`}
              filename={`${contract.numero}.pdf`}
              label="Aperçu PDF (avec CGV)"
              icon="Eye"
              className="h-9 px-3 text-sm font-medium"
            />
            {/* Lien direct conservé pour utilisateurs qui veulent ouvrir dans un onglet */}
            <a
              href={`/api/contrats/${contract.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
              title="Ouvrir dans un nouvel onglet"
            >
              <Icon name="ExternalLink" className="h-4 w-4" />
              Onglet
            </a>
            {/* Upload du PDF signé — visible tant qu'aucune signature client n'est faite */}
            {contract.statut === "ACTIF" &&
              !contract.signatures.some((s) => s.signeParClient) && (
                <UploadSignedPdfButton contractId={contract.id} />
              )}
            {contract.statut === "ACTIF" && (
              <>
                <SignInPersonButton
                  contractId={contract.id}
                  existingToken={
                    contract.signatures.find(
                      (s) =>
                        s.statut !== "COMPLETEE" && s.expireA > new Date(),
                    )?.lienSignature ?? null
                  }
                />
                {user.role === "ADMIN" && (
                  <RecordPaymentButton
                    contractId={contract.id}
                    factures={contract.clientInvoices
                      .filter((f) => f.statut !== "PAYEE")
                      .map((f) => ({
                        id: f.id,
                        numero: f.numero,
                        type: f.type,
                        total: f.total.toString(),
                        statut: f.statut,
                      }))}
                  />
                )}
                <ResilierButton contractId={contract.id} />
              </>
            )}
          </>
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

      {/* Rentabilité projet — admin uniquement */}
      {user.role === "ADMIN" && margin && (
        <div className="mt-6">
          <ProjectMarginBox
            margin={margin}
            tauxImpots={tauxImpotsProvisionne}
          />
        </div>
      )}

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
          <Field label="Prochain renouvellement">
            {(() => {
              const renewal = getNextRenewalDate({
                dateDebut: contract.dateDebut,
                dureeMois: contract.dureeMois,
                statut: contract.statut,
              });
              if (!renewal) {
                return (
                  <span className="text-muted-foreground">
                    — (pas de renouvellement prévu)
                  </span>
                );
              }
              const rel = relativeDays(renewal);
              const isClose = rel.days < 30;
              return (
                <span className={isClose ? "font-semibold text-amber-700" : ""}>
                  {formatDateLong(renewal)} ({rel.label})
                </span>
              );
            })()}
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

      {/* Signatures électroniques — audit complet */}
      {contract.signatures.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              Signatures ({contract.signatures.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract.signatures.map((sig) => (
              <div
                key={sig.id}
                className="rounded-lg border border-border bg-muted/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="font-normal">
                    {sig.statut.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-muted-foreground">
                    Lien expire le {formatDate(sig.expireA)}
                  </span>
                </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {/* Bloc client */}
                  <div className="rounded-md border border-border bg-card p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Client
                    </p>
                    {sig.signeParClient ? (
                      <>
                        <p className="mt-1 text-sm font-medium">
                          {sig.nomClient ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Signé le{" "}
                          {sig.dateSignatureClient
                            ? formatDateLong(sig.dateSignatureClient)
                            : "—"}
                          {sig.ipClient && (
                            <>
                              <br />
                              IP : <code className="font-mono">{sig.ipClient}</code>
                            </>
                          )}
                        </p>
                        {sig.signatureClientDataUrl && (
                          <div className="mt-2 overflow-hidden rounded border border-border bg-white p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sig.signatureClientDataUrl}
                              alt="Signature manuscrite du client"
                              className="h-24 w-full object-contain"
                            />
                          </div>
                        )}
                        {sig.documentSigneUrl && (
                          <div className="mt-2">
                            <DocumentPreviewButton
                              url={sig.documentSigneUrl}
                              filename={`${contract.numero}-signe.pdf`}
                              label="Voir le PDF signé reçu"
                              icon="Eye"
                              className="h-7 px-2 text-[11px]"
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        En attente de signature client
                      </p>
                    )}
                  </div>

                  {/* Bloc ACLR */}
                  <div className="rounded-md border border-border bg-card p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      ACLR Sàrl
                    </p>
                    {sig.signeParAclr ? (
                      <>
                        <p className="mt-1 text-sm font-medium">
                          ✓ Contre-signé
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Le{" "}
                          {sig.dateSignatureAclr
                            ? formatDateLong(sig.dateSignatureAclr)
                            : "—"}
                        </p>
                      </>
                    ) : sig.signeParClient && user.role === "ADMIN" ? (
                      <>
                        <p className="mt-1 text-sm text-amber-700">
                          En attente de ta contre-signature
                        </p>
                        <div className="mt-2">
                          <SignAclrButton signatureId={sig.id} />
                        </div>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        En attente
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                <Th />
              </tr>
            </thead>
            <tbody>
              {contract.clientInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
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
                    <td className="px-3 py-2 text-right">
                      {contract.statut === "ACTIF" && user.role === "ADMIN" && (
                        <MarkInvoicePaidButton
                          invoiceId={inv.id}
                          hidden={inv.statut === "PAYEE" || inv.statut === "ANNULEE"}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Paiements reçus */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Paiements reçus ({contract.payments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left">
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Référence</Th>
                <Th className="text-right">Montant</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {contract.payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    Aucun paiement encore enregistré.
                  </td>
                </tr>
              ) : (
                contract.payments.map((pay) => (
                  <tr
                    key={pay.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {formatDate(pay.date)}
                    </td>
                    <td className="px-3 py-2 text-xs">{pay.type}</td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {pay.referenceFactureClient ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatCHF(Number(pay.montant))}
                    </td>
                    <td className="px-3 py-2">
                      <PaymentStatutBadge statut={pay.statut} />
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
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Planning commissions ({commission.payments.length})
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Total {formatCHF(Number(commission.montantTotal))}
                </span>
              </CardTitle>
              <p className="mt-1 text-[11px] text-muted-foreground">
                « Acquise » = revenu déjà gagné. Le versement effectif a lieu
                une fois par mois via la facture mensuelle (étape 14).
              </p>
            </div>
            {user.role === "ADMIN" && <RecomputeButton />}
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
                  <Th>Acquise le</Th>
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
                        {COMMISSION_STATUT_LABEL[p.statut] ?? p.statut}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.dateVersement
                        ? `acquise ${formatDate(p.dateVersement)}`
                        : "—"}
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
