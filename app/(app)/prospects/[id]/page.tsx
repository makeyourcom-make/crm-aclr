import Link from "next/link";
import { notFound } from "next/navigation";

import type { ClientInvoiceStatut, ClientInvoiceType } from "@prisma/client";

import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { QuickLogActivity } from "@/components/activities/quick-log-activity";
import { ClickToCall } from "@/components/call/click-to-call";
import { ContractStatutBadge } from "@/components/contrats/contract-statut-badge";
import { SendEmailDialog } from "@/components/emails/send-email-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { ProspectStatutBadge } from "@/components/prospects/prospect-statut-badge";
import { ProspectTagsEditor } from "@/components/prospects/prospect-tags-editor";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNextRenewalDate, relativeDays } from "@/lib/contract-renewal";
import { prisma } from "@/lib/db";
import { formatDateLong, formatMoney } from "@/lib/format";
import {
  getProspectSecteurLabel,
  getProspectSourceLabel,
} from "@/lib/labels";
import { getProspectActivities } from "@/lib/queries/activities";
import { getProspectById } from "@/lib/queries/prospects";
import { requireUser } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

const INV_STATUT_LABEL: Record<ClientInvoiceStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
};
const INV_STATUT_COLOR: Record<ClientInvoiceStatut, string> = {
  BROUILLON: "bg-slate-100 text-slate-600",
  ENVOYEE: "bg-blue-100 text-blue-700",
  PAYEE: "bg-emerald-100 text-emerald-800",
  EN_RETARD: "bg-red-100 text-red-700",
  ANNULEE: "bg-slate-100 text-slate-400 line-through",
};
const INV_TYPE_LABEL: Record<ClientInvoiceType, string> = {
  ACOMPTE: "Acompte",
  SOLDE: "Solde",
  MENSUALITE: "Mensualité",
  ANNUELLE: "Annuelle",
  PONCTUELLE: "Ponctuelle",
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Prospect ${id.slice(0, 8)}…` };
}

export default async function ProspectDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const [
    prospect,
    activities,
    emailTemplates,
    allTags,
    emailSignatures,
    contracts,
    clientInvoices,
  ] = await Promise.all([
    getProspectById(user, id),
    getProspectActivities(id, user),
    prisma.emailTemplate.findMany({
      select: { id: true, nom: true, objet: true, contenu: true },
      orderBy: { nom: "asc" },
    }),
    prisma.prospectTag.findMany({
      select: { id: true, nom: true, couleur: true },
      orderBy: { nom: "asc" },
    }),
    prisma.emailSignature.findMany({
      where: { userId: user.id },
      select: { id: true, nom: true, html: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { nom: "asc" }],
    }),
    prisma.contract.findMany({
      where: { prospectId: id },
      select: {
        id: true,
        numero: true,
        statut: true,
        dateDebut: true,
        dureeMois: true,
        devise: true,
        montantOneShot: true,
        montantMensuel: true,
        valeurAn1: true,
      },
      orderBy: { dateDebut: "desc" },
    }),
    prisma.clientInvoice.findMany({
      where: { contract: { prospectId: id } },
      select: {
        id: true,
        numero: true,
        type: true,
        statut: true,
        total: true,
        devise: true,
        dateEmission: true,
        dateEcheance: true,
      },
      orderBy: { dateEmission: "desc" },
    }),
  ]);

  if (!prospect) notFound();

  // Prochaine échéance = la plus proche entre renouvellement d'un contrat
  // actif et prochaine facture à échéance non payée.
  const now = new Date();
  const echeances: { date: Date; label: string }[] = [];
  for (const c of contracts) {
    const r = getNextRenewalDate({
      dateDebut: c.dateDebut,
      dureeMois: c.dureeMois,
      statut: c.statut,
    });
    if (r) echeances.push({ date: r, label: `Renouvellement ${c.numero}` });
  }
  const prochaineFacture = clientInvoices
    .filter(
      (f) =>
        f.statut !== "PAYEE" &&
        f.statut !== "ANNULEE" &&
        f.dateEcheance >= now,
    )
    .sort((a, b) => a.dateEcheance.getTime() - b.dateEcheance.getTime())[0];
  if (prochaineFacture) {
    echeances.push({
      date: prochaineFacture.dateEcheance,
      label: `Facture ${prochaineFacture.numero}`,
    });
  }
  const prochaineEcheance =
    echeances.sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 lg:px-8">
      <PageHeader
        title={prospect.raisonSociale}
        description={[
          prospect.contactPrenom,
          prospect.contactNom,
          prospect.contactFonction && `· ${prospect.contactFonction}`,
        ]
          .filter(Boolean)
          .join(" ") || undefined}
        breadcrumb={
          <Link
            href="/prospects"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux prospects
          </Link>
        }
        actions={
          <>
            <SendEmailDialog
              prospectId={prospect.id}
              prospectEmail={prospect.email}
              prospectName={prospect.raisonSociale}
              templates={emailTemplates}
              signatures={emailSignatures}
              triggerVariant="default"
            />
            <Link
              href={`/prospects/${prospect.id}/modifier`}
              className={buttonVariants({ variant: "outline" })}
            >
              Modifier
            </Link>
          </>
        }
      />

      {/* Ligne en-tête */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProspectStatutBadge statut={prospect.statut} />
        {prospect.secteur && (
          <span className="text-xs text-muted-foreground">
            · {getProspectSecteurLabel(prospect.secteur)}
          </span>
        )}
        {prospect.source && (
          <span className="text-xs text-muted-foreground">
            · Source : {getProspectSourceLabel(prospect.source)}
          </span>
        )}
      </div>

      {/* Tags — admin peut éditer, Sophie lit seulement */}
      <div className="mb-6">
        <ProspectTagsEditor
          prospectId={prospect.id}
          currentTags={prospect.tags.map((t) => ({
            id: t.tag.id,
            nom: t.tag.nom,
            couleur: t.tag.couleur,
          }))}
          allTags={allTags}
          canEdit={user.role === "ADMIN"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coordonnées */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Email">
              {prospect.email ? (
                <a
                  href={`mailto:${prospect.email}`}
                  className="text-primary hover:underline"
                >
                  {prospect.email}
                </a>
              ) : (
                "—"
              )}
            </Field>

            <Field label="Téléphone">
              {prospect.telephone ? (
                <ClickToCall
                  prospectId={prospect.id}
                  prospectRaisonSociale={prospect.raisonSociale}
                  numero={prospect.telephone}
                />
              ) : (
                "—"
              )}
            </Field>

            <Field label="Mobile">
              {prospect.telephoneMobile ? (
                <ClickToCall
                  prospectId={prospect.id}
                  prospectRaisonSociale={prospect.raisonSociale}
                  numero={prospect.telephoneMobile}
                />
              ) : (
                "—"
              )}
            </Field>

            <Field label="Site web">
              {prospect.siteWeb ? (
                <a
                  href={prospect.siteWeb}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {prospect.siteWeb}
                </a>
              ) : (
                "—"
              )}
            </Field>

            <Field label="LinkedIn">
              {prospect.linkedIn ? (
                <a
                  href={prospect.linkedIn}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {prospect.linkedIn}
                </a>
              ) : (
                "—"
              )}
            </Field>

            <Field label="Effectif">{prospect.effectif ?? "—"}</Field>

            <Field label="Adresse" className="sm:col-span-2">
              <div className="text-sm">
                {prospect.adresse && <div>{prospect.adresse}</div>}
                <div>
                  {[prospect.codePostal, prospect.ville]
                    .filter(Boolean)
                    .join(" ") || "—"}
                  {prospect.canton ? ` · ${prospect.canton}` : ""}
                  {prospect.pays ? ` · ${prospect.pays}` : ""}
                </div>
              </div>
            </Field>
          </CardContent>
        </Card>

        {/* Méta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Méta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {prochaineEcheance && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-xs uppercase tracking-wider text-amber-700">
                  Prochaine échéance
                </p>
                <p className="mt-0.5 font-medium text-amber-900">
                  {formatDateLong(prochaineEcheance.date)}{" "}
                  <span className="text-xs font-normal">
                    ({relativeDays(prochaineEcheance.date).label})
                  </span>
                </p>
                <p className="text-xs text-amber-700/80">
                  {prochaineEcheance.label}
                </p>
              </div>
            )}
            <Field label="Assigné à">
              {prospect.assigneA?.name ?? "—"}
            </Field>
            <Field label="Créé le">{formatDateLong(prospect.createdAt)}</Field>
            <Field label="Dernière modif.">
              {formatDateLong(prospect.updatedAt)}
            </Field>
            {prospect.noga && <Field label="Code NOGA">{prospect.noga}</Field>}
            <div className="border-t pt-3 text-xs text-muted-foreground">
              {prospect._count.activities} activités ·{" "}
              {prospect._count.deals} deals ·{" "}
              {prospect._count.contracts} contrats
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contrats du client */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle className="text-base">
            Contrats
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({contracts.length})
            </span>
          </CardTitle>
          <Link
            href={`/contrats/nouveau?prospectId=${prospect.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Icon name="Plus" className="mr-1 h-3.5 w-3.5" />
            Nouveau contrat
          </Link>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun contrat.</p>
          ) : (
            <div className="divide-y divide-border">
              {contracts.map((c) => {
                const renouv = getNextRenewalDate({
                  dateDebut: c.dateDebut,
                  dureeMois: c.dureeMois,
                  statut: c.statut,
                });
                return (
                <Link
                  key={c.id}
                  href={`/contrats/${c.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.numero}</span>
                      <ContractStatutBadge statut={c.statut} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Début {formatDateLong(c.dateDebut)} · {c.dureeMois} mois
                      {renouv && (
                        <>
                          {" · "}
                          <span className="text-amber-700">
                            Renouvellement {formatDateLong(renouv)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {formatMoney(Number(c.valeurAn1), c.devise)}
                    </p>
                    {Number(c.montantMensuel) > 0 && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatMoney(Number(c.montantMensuel), c.devise)}/mois
                      </p>
                    )}
                  </div>
                </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Factures du client */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Factures
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({clientInvoices.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clientInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune facture.</p>
          ) : (
            <div className="divide-y divide-border">
              {clientInvoices.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{f.numero}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-normal",
                          INV_STATUT_COLOR[f.statut],
                        )}
                      >
                        {INV_STATUT_LABEL[f.statut]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {INV_TYPE_LABEL[f.type]} · Émise{" "}
                      {formatDateLong(f.dateEmission)} · Échéance{" "}
                      {formatDateLong(f.dateEcheance)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="font-semibold tabular-nums">
                      {formatMoney(Number(f.total), f.devise)}
                    </p>
                    <a
                      href={`/api/factures-clients/${f.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      title="Télécharger le PDF"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
                    >
                      <Icon name="Download" className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes générales */}
      {prospect.notesGenerales && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Notes générales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm">
              {prospect.notesGenerales}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timeline d'activités */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base">
            Activités
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({prospect._count.activities} total)
            </span>
          </CardTitle>
          <QuickLogActivity
            prospectId={prospect.id}
            prospectRaisonSociale={prospect.raisonSociale}
          />
        </CardHeader>
        <CardContent>
          <ActivityTimeline activities={activities} showUser={user.role === "ADMIN"} />
        </CardContent>
      </Card>
    </div>
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
      <p className="mt-0.5 text-foreground">{children}</p>
    </div>
  );
}
