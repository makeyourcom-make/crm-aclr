import Link from "next/link";
import { notFound } from "next/navigation";

import type { ClientInvoiceStatut, ClientInvoiceType } from "@prisma/client";

import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { QuickLogActivity } from "@/components/activities/quick-log-activity";
import { ClickToCall } from "@/components/call/click-to-call";
import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { ContractStatutBadge } from "@/components/contrats/contract-statut-badge";
import { SendEmailDialog } from "@/components/emails/send-email-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { BackToProspects } from "@/components/prospects/back-to-prospects";
import { ProspectStatutSelect } from "@/components/prospects/prospect-statut-select";
import { InlineEditField } from "@/components/prospects/inline-edit-field";
import { MarkOpenedOnMount } from "@/components/prospects/mark-opened-on-mount";
import { GdprTools } from "@/components/prospects/gdpr-tools";
import { ProspectTagsEditor } from "@/components/prospects/prospect-tags-editor";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNextRenewalDate, relativeDays } from "@/lib/contract-renewal";
import { prisma } from "@/lib/db";
import { getDossierStatutLabel } from "@/lib/dossiers";
import { formatDateLong, formatMoney } from "@/lib/format";
import {
  getProspectSecteurLabel,
  getProspectSourceLabel,
} from "@/lib/labels";
import { getProspectActivities } from "@/lib/queries/activities";
import { getDossiersForProspect } from "@/lib/queries/dossiers";
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
    dossiers,
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
    getDossiersForProspect(user, id),
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
      <MarkOpenedOnMount prospectId={prospect.id} />
      <PageHeader
        title={prospect.raisonSociale}
        description={[
          prospect.contactPrenom,
          prospect.contactNom,
          prospect.contactFonction && `· ${prospect.contactFonction}`,
        ]
          .filter(Boolean)
          .join(" ") || undefined}
        breadcrumb={<BackToProspects />}
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ProspectStatutSelect
          prospectId={prospect.id}
          statut={prospect.statut}
        />
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

      {/* Recherche externe rapide */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(prospect.raisonSociale)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
        >
          <Icon name="Search" className="h-3.5 w-3.5" />
          Google
        </a>
        <a
          href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
            [prospect.contactPrenom, prospect.contactNom]
              .filter(Boolean)
              .join(" ") || prospect.raisonSociale,
          )}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
        >
          <Icon name="ExternalLink" className="h-3.5 w-3.5 text-[#0a66c2]" />
          LinkedIn
        </a>
        <a
          href={`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(prospect.raisonSociale)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
        >
          <Icon name="ExternalLink" className="h-3.5 w-3.5 text-[#e1306c]" />
          Instagram
        </a>
      </div>

      {/* Tags — éditable par l'admin ou le commercial propriétaire du client */}
      <div className="mb-6">
        <ProspectTagsEditor
          prospectId={prospect.id}
          currentTags={prospect.tags.map((t) => ({
            id: t.tag.id,
            nom: t.tag.nom,
            couleur: t.tag.couleur,
          }))}
          allTags={allTags}
          canEdit={user.role === "ADMIN" || prospect.assigneAId === user.id}
        />
      </div>

      {/* Outils LPD/RGPD — admin uniquement */}
      {user.role === "ADMIN" && (
        <div className="mb-6">
          <GdprTools
            prospectId={prospect.id}
            raisonSociale={prospect.raisonSociale}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coordonnées */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Email">
              <InlineEditField
                prospectId={prospect.id}
                field="email"
                value={prospect.email}
                placeholder="email@…"
                openHref={prospect.email ? `mailto:${prospect.email}` : null}
              />
            </Field>

            <Field label="Téléphone">
              <InlineEditField
                prospectId={prospect.id}
                field="telephone"
                value={prospect.telephone}
                placeholder="+41 …"
                displayNode={
                  prospect.telephone ? (
                    <ClickToCall
                      prospectId={prospect.id}
                      prospectRaisonSociale={prospect.raisonSociale}
                      numero={prospect.telephone}
                    />
                  ) : undefined
                }
              />
            </Field>

            <Field label="Mobile">
              <InlineEditField
                prospectId={prospect.id}
                field="telephoneMobile"
                value={prospect.telephoneMobile}
                placeholder="+41 …"
                displayNode={
                  prospect.telephoneMobile ? (
                    <ClickToCall
                      prospectId={prospect.id}
                      prospectRaisonSociale={prospect.raisonSociale}
                      numero={prospect.telephoneMobile}
                    />
                  ) : undefined
                }
              />
            </Field>

            <Field label="Site web">
              <InlineEditField
                prospectId={prospect.id}
                field="siteWeb"
                value={prospect.siteWeb}
                placeholder="https://…"
                openHref={prospect.siteWeb}
                openIcon="Globe"
              />
            </Field>

            <Field label="LinkedIn">
              <InlineEditField
                prospectId={prospect.id}
                field="linkedIn"
                value={prospect.linkedIn}
                placeholder="URL LinkedIn"
                openHref={prospect.linkedIn}
                openIcon="ExternalLink"
              />
            </Field>

            <Field label="Effectif">
              <InlineEditField
                prospectId={prospect.id}
                field="effectif"
                value={
                  prospect.effectif != null ? String(prospect.effectif) : null
                }
                type="number"
                placeholder="0"
              />
            </Field>

            <Field label="Adresse" className="sm:col-span-2">
              <div className="space-y-1">
                <InlineEditField
                  prospectId={prospect.id}
                  field="adresse"
                  value={prospect.adresse}
                  placeholder="Rue et n°"
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="codePostal"
                    value={prospect.codePostal}
                    placeholder="NPA"
                  />
                  <InlineEditField
                    prospectId={prospect.id}
                    field="ville"
                    value={prospect.ville}
                    placeholder="Ville"
                  />
                  {(prospect.canton || prospect.pays) && (
                    <span className="text-xs text-muted-foreground">
                      {prospect.canton ? `· ${prospect.canton}` : ""}
                      {prospect.pays ? ` · ${prospect.pays}` : ""}
                    </span>
                  )}
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
                    <DocumentPreviewButton
                      url={`/api/factures-clients/${f.id}/pdf`}
                      filename={`${f.numero}.pdf`}
                      label="Voir"
                      className="h-8 px-2.5 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projets / tâches du client — inclut l'historique archivé */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle className="text-base">
            Projets / tâches
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({dossiers.length})
            </span>
          </CardTitle>
          <Link
            href="/dossiers"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Icon name="ClipboardList" className="mr-1.5 h-4 w-4" />
            Gestion des projets
          </Link>
        </CardHeader>
        <CardContent>
          {dossiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune tâche rattachée à ce client.
            </p>
          ) : (
            <div className="space-y-2">
              {dossiers.map((d) => (
                <div
                  key={d.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border p-3",
                    // L'historique passe en retrait visuel : il est là pour être
                    // consulté, pas pour attirer l'œil comme le travail en cours.
                    d.archive && "bg-muted/30 opacity-75",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {d.titre}
                  </span>

                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      d.statut === "TERMINE"
                        ? "bg-emerald-100 text-emerald-800"
                        : d.statut === "EN_COURS"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {getDossierStatutLabel(d.statut)}
                  </span>

                  {d.archive && (
                    <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      Archivée
                    </span>
                  )}

                  {d.nbDocuments > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      📎 {d.nbDocuments}
                    </span>
                  )}
                  {d.nbUpdates > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      💬 {d.nbUpdates}
                    </span>
                  )}

                  <span className="text-xs text-muted-foreground">
                    {d.assigneA.name.split(" ")[0]}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {d.termineLe
                      ? `Terminée le ${formatDateLong(d.termineLe)}`
                      : d.echeance
                        ? `Échéance ${formatDateLong(d.echeance)}`
                        : ""}
                  </span>
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
