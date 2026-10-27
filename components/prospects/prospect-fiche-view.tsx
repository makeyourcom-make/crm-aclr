/**
 * Vue de la fiche entreprise (MYC Arena) : identité + score de chaleur,
 * appel en un clic, email / RDV / deal, étapes du statut, prochaine meilleure
 * action, coordonnées éditables, historique avec XP, deals et contrats,
 * notes, factures, projets, méta et outils RGPD (admin).
 * Aucune requête ici : données de `loadProspectFiche`. Server-safe.
 */
import {
  CalendarClock,
  ClipboardList,
  FileText,
  History,
  Info,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Search,
  SquareKanban,
  StickyNote,
  UserRound,
  Zap,
} from "lucide-react";
import Link from "next/link";

import type { ClientInvoiceStatut, ClientInvoiceType } from "@prisma/client";

import { Meter, ProgressRing, SectionCard, XpPill, formatInt } from "@/components/arena";
import { QuickLogActivity } from "@/components/activities/quick-log-activity";
import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { ContractStatutBadge } from "@/components/contrats/contract-statut-badge";
import { SendEmailDialog } from "@/components/emails/send-email-dialog";
import { BackToProspects } from "@/components/prospects/back-to-prospects";
import { CallButton } from "@/components/prospects/call-button";
import { GdprTools } from "@/components/prospects/gdpr-tools";
import { InlineEditField } from "@/components/prospects/inline-edit-field";
import {
  OPEN_DEAL_STAGES,
  activityXp,
  companyInitials,
  computeLeadHeat,
  ficheCompleteness,
  nextBestAction,
  type LeadHeat,
} from "@/components/prospects/lead-heat";
import { MarkOpenedOnMount } from "@/components/prospects/mark-opened-on-mount";
import { PlanRdvDialog } from "@/components/prospects/plan-rdv-dialog";
import { ProspectStatusStepper } from "@/components/prospects/prospect-status-stepper";
import { ProspectStatutBadge } from "@/components/prospects/prospect-statut-badge";
import { ProspectTagsEditor } from "@/components/prospects/prospect-tags-editor";
import { ProspectTimeline } from "@/components/prospects/prospect-timeline";
import { fmtDate } from "@/components/prospects/zurich-format";
import { buttonVariants } from "@/components/ui/button";
import { getNextRenewalDate, relativeDays } from "@/lib/contract-renewal";
import { getDossierStatutLabel } from "@/lib/dossiers";
import { formatCHFCompact, formatMoney } from "@/lib/format";
import {
  getDealStageLabel,
  getProspectSecteurLabel,
  getProspectSourceLabel,
} from "@/lib/labels";
import { XP_RULES, type Tone } from "@/lib/gamification/rules";
import type { ProspectFicheData } from "@/lib/queries/prospects-pages";
import { cn } from "@/lib/utils";

const INV_STATUT_LABEL: Record<ClientInvoiceStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
};
const INV_STATUT_COLOR: Record<ClientInvoiceStatut, string> = {
  BROUILLON: "bg-navy-50 text-navy-500",
  ENVOYEE: "bg-info-50 text-info-700",
  PAYEE: "bg-win-50 text-win-700",
  EN_RETARD: "bg-alert-50 text-alert-700",
  ANNULEE: "bg-navy-50 text-muted-foreground line-through",
};
const INV_TYPE_LABEL: Record<ClientInvoiceType, string> = {
  ACOMPTE: "Acompte",
  SOLDE: "Solde",
  MENSUALITE: "Mensualité",
  ANNUELLE: "Annuelle",
  PONCTUELLE: "Ponctuelle",
};

/** Encart « prochaine meilleure action » : fond clair + texte foncé de la teinte. */
const NBA_TONE: Record<Tone, { box: string; text: string }> = {
  coral: { box: "bg-coral-50", text: "text-coral-600" },
  navy: { box: "bg-navy-50", text: "text-navy-500" },
  green: { box: "bg-win-50", text: "text-win-700" },
  gold: { box: "bg-gold-50", text: "text-gold-700" },
  blue: { box: "bg-info-50", text: "text-info-700" },
  violet: { box: "bg-lvl-50", text: "text-lvl-700" },
  teal: { box: "bg-mail-50", text: "text-mail-700" },
  red: { box: "bg-alert-50", text: "text-alert-700" },
};

const DEAL_TILE: Record<string, string> = {
  DECOUVERTE: "bg-lvl-50 text-lvl-700",
  PROPOSITION: "bg-lvl-50 text-lvl-700",
  NEGOCIATION: "bg-gold-50 text-gold-700",
  SIGNE: "bg-win-50 text-win-700",
  PERDU: "bg-navy-50 text-muted-foreground",
};

/** Tuile d'action (Email / RDV / Deal) : 64 px, icône + libellé. */
const ACTION_TILE =
  "flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-[12px] border border-border-strong bg-card px-1.5 py-2 text-center text-[13px] leading-tight font-bold text-foreground transition-colors hover:bg-navy-50";

export function ProspectFicheView({
  data,
  user,
  nowMs,
}: {
  data: ProspectFicheData;
  user: { id: string; role: string };
  nowMs: number;
}) {
  const {
    prospect,
    activities,
    emailTemplates,
    allTags,
    emailSignatures,
    contracts,
    clientInvoices,
    dossiers,
    deals,
  } = data;

  const now = new Date(nowMs);

  // Prochaine échéance = la plus proche entre renouvellement d'un contrat
  // actif et prochaine facture à échéance non payée.
  const echeances: { date: Date; label: string }[] = [];
  for (const c of contracts) {
    const r = getNextRenewalDate({
      dateDebut: c.dateDebut,
      dureeMois: c.dureeMois,
      statut: c.statut,
      reconductible: c.reconductible,
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

  // ---- Couche de jeu (données réelles) ------------------------------------
  const hasOpenDeal = deals.some((d) =>
    (OPEN_DEAL_STAGES as readonly string[]).includes(d.stage),
  );
  const heat = computeLeadHeat(
    {
      statut: prospect.statut,
      derniereActionLe: prospect.derniereActionLe,
      dateRdvLe: prospect.dateRdvLe,
      hasOpenDeal,
    },
    nowMs,
  );
  const nextPlanned =
    activities
      .filter((a) => a.statut === "PLANIFIE")
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;
  const nba = nextBestAction(
    {
      statut: prospect.statut,
      derniereActionLe: prospect.derniereActionLe,
      dernierAppelLe: prospect.dernierAppelLe,
      dateRdvLe: prospect.dateRdvLe,
      contratDebutLe: prospect.contratDebutLe,
      hasOpenDeal,
      hasPhone: !!(prospect.telephone || prospect.telephoneMobile),
      hasEmail: !!prospect.email,
      nextPlanned,
    },
    nowMs,
  );
  const completeness = ficheCompleteness(prospect);
  const ficheXp = activities.reduce((sum, a) => sum + activityXp(a, nowMs), 0);

  const contactName = [prospect.contactPrenom, prospect.contactNom]
    .filter(Boolean)
    .join(" ");
  const primaryPhone = prospect.telephoneMobile || prospect.telephone;
  const lieu = [prospect.ville, prospect.canton].filter(Boolean).join(", ");
  const canEdit = user.role === "ADMIN" || prospect.assigneAId === user.id;
  const isAdmin = user.role === "ADMIN";
  const adresseComplete = [
    prospect.adresse,
    [prospect.codePostal, prospect.ville].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const nbaTone = NBA_TONE[nba.tone];
  const searchName = contactName || prospect.raisonSociale;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <MarkOpenedOnMount prospectId={prospect.id} />
      <div className="mb-3">
        <BackToProspects />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        {/* ================= COLONNE IDENTITÉ / ACTIONS ================= */}
        <div className="flex min-w-0 flex-col gap-6">
          <section
            aria-labelledby="fiche-titre"
            className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-4 shadow-arena-lg sm:p-5"
          >
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-info-50 font-display text-lg font-extrabold text-info-700"
              >
                {companyInitials(prospect.raisonSociale)}
              </span>
              <div className="min-w-0 flex-1">
                <h1
                  id="fiche-titre"
                  className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] break-words sm:text-2xl"
                >
                  {prospect.raisonSociale}
                </h1>
                {(lieu || prospect.secteur) && (
                  <p className="mt-1 text-[13px] font-semibold text-muted-foreground">
                    {[lieu, prospect.secteur && getProspectSecteurLabel(prospect.secteur)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {(contactName || prospect.contactFonction) && (
                  <p className="mt-0.5 text-[13px] font-bold text-foreground">
                    {[contactName, prospect.contactFonction].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <ProspectStatutBadge statut={prospect.statut} />
                  <HeatPill heat={heat} />
                </div>
              </div>
              <ProgressRing
                value={heat.score}
                max={100}
                size={64}
                stroke={7}
                tone={heat.tone}
                label={`Score du lead : ${heat.score} sur 100, ${heat.label.toLowerCase()}`}
              >
                <span className="score-number text-lg">{heat.score}</span>
                <span className="mt-0.5 text-[8px] font-bold tracking-[0.08em] text-muted-foreground">
                  SCORE
                </span>
              </ProgressRing>
            </div>

            {/* Tags : éditables par l'admin ou le commercial propriétaire */}
            <ProspectTagsEditor
              prospectId={prospect.id}
              currentTags={prospect.tags.map((t) => ({
                id: t.tag.id,
                nom: t.tag.nom,
                couleur: t.tag.couleur,
              }))}
              allTags={allTags}
              canEdit={canEdit}
            />

            {primaryPhone ? (
              <CallButton
                prospectId={prospect.id}
                prospectRaisonSociale={prospect.raisonSociale}
                numero={primaryPhone}
                variant="cta"
                label={prospect.contactPrenom ? `Appeler ${prospect.contactPrenom}` : "Appeler"}
              />
            ) : (
              <a
                href="#coordonnees"
                className="flex min-h-[52px] items-center justify-center rounded-[12px] border border-dashed border-gold-500 bg-gold-50 px-4 text-center text-sm font-bold text-gold-700"
              >
                Pas de numéro sur la fiche : ajoute-le pour pouvoir appeler
              </a>
            )}

            <div className="grid grid-cols-3 gap-2">
              {prospect.email ? (
                <div className="min-w-0 [&>button]:flex [&>button]:h-auto [&>button]:min-h-16 [&>button]:w-full [&>button]:flex-col [&>button]:justify-center [&>button]:gap-1 [&>button]:rounded-[12px] [&>button]:border-border-strong [&>button]:bg-card [&>button]:px-1.5 [&>button]:py-2 [&>button]:text-center [&>button]:text-[13px] [&>button]:leading-tight [&>button]:font-bold [&>button]:text-foreground [&>button]:hover:bg-navy-50 [&>button_svg]:size-[18px] [&>button_svg]:text-mail-700">
                  <SendEmailDialog
                    prospectId={prospect.id}
                    prospectEmail={prospect.email}
                    prospectName={prospect.raisonSociale}
                    templates={emailTemplates}
                    signatures={emailSignatures}
                    triggerVariant="outline"
                  />
                </div>
              ) : (
                <a
                  href="#coordonnees"
                  className={cn(ACTION_TILE, "border-dashed border-gold-500 bg-gold-50 text-gold-700 hover:bg-gold-50")}
                >
                  <FileText aria-hidden="true" className="size-[18px]" />
                  Ajouter l&apos;email
                </a>
              )}
              <PlanRdvDialog
                prospectId={prospect.id}
                prospectRaisonSociale={prospect.raisonSociale}
                statut={prospect.statut}
                adresseDefaut={adresseComplete || null}
                triggerClassName={ACTION_TILE}
              />
              <Link
                href={`/pipeline/nouveau?prospectId=${prospect.id}`}
                className={ACTION_TILE}
              >
                <SquareKanban aria-hidden="true" className="size-[18px] text-lvl-700" />
                Créer un deal
              </Link>
            </div>

            <ProspectStatusStepper prospectId={prospect.id} statut={prospect.statut} />

            <div className={cn("flex items-start gap-3 rounded-[14px] px-3.5 py-3", nbaTone.box)}>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-card",
                  nbaTone.text,
                )}
              >
                <Zap className="size-[18px] fill-current" />
              </span>
              <div className="min-w-0">
                <p className={cn("text-[11px] font-bold tracking-[0.08em] uppercase", nbaTone.text)}>
                  Prochaine meilleure action
                </p>
                <p className="mt-0.5 text-sm leading-snug font-bold text-foreground">{nba.text}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/prospects/${prospect.id}/modifier`}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                <Pencil aria-hidden="true" />
                Modifier la fiche
              </Link>
              <Link
                href={`/contrats/nouveau?prospectId=${prospect.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                <Plus aria-hidden="true" />
                Nouveau contrat
              </Link>
            </div>
          </section>

          {/* Coordonnées */}
          <SectionCard
            id="coordonnees"
            title="Contact & coordonnées"
            icon={UserRound}
            tone="blue"
            className="scroll-mt-20 gap-4"
            action={
              <Link
                href={`/prospects/${prospect.id}/modifier`}
                className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-navy-50 px-2.5 text-xs font-bold text-foreground hover:bg-navy-100"
              >
                <Pencil aria-hidden="true" className="size-3.5" />
                Modifier
              </Link>
            }
          >
            <div className="@container flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 @lg:grid-cols-3">
                <ContactField label="Prénom">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="contactPrenom"
                    label="prénom du contact"
                    value={prospect.contactPrenom}
                    placeholder="Ajouter"
                  />
                </ContactField>
                <ContactField label="Nom">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="contactNom"
                    label="nom du contact"
                    value={prospect.contactNom}
                    placeholder="Ajouter"
                  />
                </ContactField>
                <ContactField label="Fonction" className="col-span-2 @lg:col-span-1">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="contactFonction"
                    label="fonction du contact"
                    value={prospect.contactFonction}
                    placeholder="Ajouter"
                  />
                </ContactField>
              </div>

              {(prospect.telephone || prospect.telephoneMobile) && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
                  {prospect.telephone && (
                    <CallButton
                      prospectId={prospect.id}
                      prospectRaisonSociale={prospect.raisonSociale}
                      numero={prospect.telephone}
                      variant="tile"
                      label="Fixe · appeler"
                    />
                  )}
                  {prospect.telephoneMobile ? (
                    <CallButton
                      prospectId={prospect.id}
                      prospectRaisonSociale={prospect.raisonSociale}
                      numero={prospect.telephoneMobile}
                      variant="tile"
                      label="Mobile · appeler"
                    />
                  ) : (
                    <div className="flex min-h-14 flex-col justify-center rounded-[12px] border border-dashed border-border-strong px-3 py-2.5">
                      <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                        Mobile
                      </span>
                      <span className="mt-0.5 text-[13px] font-bold text-gold-700">À trouver</span>
                    </div>
                  )}
                </div>
              )}

              <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm @md:grid-cols-2">
                <ContactField label="Email" as="dl">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="email"
                    label="email"
                    value={prospect.email}
                    placeholder={`Ajouter l'email (+${XP_RULES.email} XP par email envoyé)`}
                    openHref={prospect.email ? `mailto:${prospect.email}` : null}
                    openIcon="Mail"
                  />
                </ContactField>
                <ContactField label="Email de facturation" as="dl">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="emailFacturation"
                    label="email de facturation"
                    value={prospect.emailFacturation}
                    placeholder={
                      prospect.email
                        ? `Par défaut : ${prospect.email}`
                        : "factures@entreprise.ch"
                    }
                    openHref={
                      prospect.emailFacturation
                        ? `mailto:${prospect.emailFacturation}`
                        : null
                    }
                    openIcon="Mail"
                  />
                </ContactField>
                <ContactField label="Téléphone fixe" as="dl">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="telephone"
                    label="téléphone fixe"
                    value={prospect.telephone}
                    placeholder="+41 ..."
                    displayNode={
                      prospect.telephone ? (
                        <CallButton
                          prospectId={prospect.id}
                          prospectRaisonSociale={prospect.raisonSociale}
                          numero={prospect.telephone}
                          variant="inline"
                        />
                      ) : undefined
                    }
                  />
                </ContactField>
                <ContactField label="Mobile" as="dl">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="telephoneMobile"
                    label="mobile"
                    value={prospect.telephoneMobile}
                    placeholder="+41 ..."
                    displayNode={
                      prospect.telephoneMobile ? (
                        <CallButton
                          prospectId={prospect.id}
                          prospectRaisonSociale={prospect.raisonSociale}
                          numero={prospect.telephoneMobile}
                          variant="inline"
                        />
                      ) : undefined
                    }
                  />
                </ContactField>
                <ContactField label="Site web" as="dl">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="siteWeb"
                    label="site web"
                    value={prospect.siteWeb}
                    placeholder="Pas de site : argument Site internet - SEO"
                    openHref={prospect.siteWeb}
                    openIcon="Globe"
                  />
                </ContactField>
                <ContactField label="LinkedIn" as="dl">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="linkedIn"
                    label="LinkedIn"
                    value={prospect.linkedIn}
                    placeholder="URL LinkedIn"
                    openHref={prospect.linkedIn}
                    openIcon="ExternalLink"
                  />
                </ContactField>
                <ContactField label="Effectif" as="dl">
                  <InlineEditField
                    prospectId={prospect.id}
                    field="effectif"
                    label="effectif"
                    value={prospect.effectif != null ? String(prospect.effectif) : null}
                    type="number"
                    placeholder="Ajouter"
                  />
                </ContactField>
                <ContactField label="Source" as="dl">
                  <span className="text-sm font-bold">
                    {prospect.source ? getProspectSourceLabel(prospect.source) : "Non renseignée"}
                    {prospect.assigneA?.name ? (
                      <span className="font-semibold text-muted-foreground">
                        {" "}
                        · assignée à {prospect.assigneA.name}
                      </span>
                    ) : null}
                  </span>
                </ContactField>
                <ContactField label="Adresse" as="dl" className="@md:col-span-2">
                  <div className="flex flex-col gap-1">
                    <InlineEditField
                      prospectId={prospect.id}
                      field="adresse"
                      label="adresse"
                      value={prospect.adresse}
                      placeholder="Rue et n°"
                    />
                    <div className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
                      <InlineEditField
                        prospectId={prospect.id}
                        field="codePostal"
                        label="NPA"
                        value={prospect.codePostal}
                        placeholder="NPA"
                      />
                      <InlineEditField
                        prospectId={prospect.id}
                        field="ville"
                        label="ville"
                        value={prospect.ville}
                        placeholder="Ville"
                      />
                    </div>
                    {(prospect.canton || prospect.pays) && (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {[prospect.canton, prospect.pays].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                </ContactField>
              </dl>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Creuser :</span>
                <ExternalSearch
                  href={`https://www.google.com/search?q=${encodeURIComponent(prospect.raisonSociale)}`}
                  label="Google"
                />
                <ExternalSearch
                  href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(searchName)}`}
                  label="LinkedIn"
                />
                <ExternalSearch
                  href={`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(prospect.raisonSociale)}`}
                  label="Instagram"
                />
              </div>

              <div className="border-t border-border pt-3">
                <Meter
                  value={completeness.filled}
                  max={completeness.total}
                  tone="gold"
                  size="md"
                  label={`Fiche complète à ${completeness.pct} %`}
                  valueLabel={
                    <span className="font-bold text-gold-700">
                      {completeness.hint ?? "Fiche parfaite"}
                    </span>
                  }
                />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ================= COLONNE ACTIVITÉ / BUSINESS ================= */}
        <div className="flex min-w-0 flex-col gap-6">
          <SectionCard
            title={`Historique · ${formatInt(prospect._count.activities)} activité${prospect._count.activities > 1 ? "s" : ""}`}
            icon={History}
            tone="coral"
            description={
              ficheXp > 0 ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  Cette fiche a déjà rapporté <XpPill xp={ficheXp} />
                </span>
              ) : (
                "Chaque action rapporte des XP : appel +5, décroché +10, RDV pris +50."
              )
            }
            action={
              <div className="[&>button]:h-9 [&>button]:rounded-[10px] [&>button]:border-transparent [&>button]:bg-navy-700 [&>button]:px-3 [&>button]:text-xs [&>button]:font-bold [&>button]:text-white [&>button]:hover:bg-navy-600">
                <QuickLogActivity
                  prospectId={prospect.id}
                  prospectRaisonSociale={prospect.raisonSociale}
                />
              </div>
            }
          >
            {activities.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-coral-400 bg-coral-50 px-4 py-3.5 text-[13px] leading-relaxed font-bold text-coral-600">
                Aucune activité pour l&apos;instant. Ce lead est vierge : premier appel = +
                {XP_RULES.appel} XP, premier RDV = +{XP_RULES.rdvPris} XP. À toi de jouer.
              </p>
            ) : (
              <>
                <ProspectTimeline activities={activities} nowMs={nowMs} showUser={isAdmin} />
                {prospect._count.activities > activities.length && (
                  <p className="mt-4 text-xs font-semibold text-muted-foreground">
                    Les {formatInt(activities.length)} activités les plus récentes sont affichées.
                  </p>
                )}
              </>
            )}
          </SectionCard>

          <SectionCard
            title="Deals & contrats"
            icon={SquareKanban}
            tone="violet"
            description={`${formatInt(deals.length)} deal${deals.length > 1 ? "s" : ""} · ${formatInt(contracts.length)} contrat${contracts.length > 1 ? "s" : ""}`}
            action={
              <>
                <Link
                  href={`/pipeline/nouveau?prospectId=${prospect.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-lvl-50 px-3 text-xs font-extrabold text-lvl-700 hover:brightness-95"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  Créer un deal
                </Link>
                <Link
                  href={`/contrats/nouveau?prospectId=${prospect.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  <Plus aria-hidden="true" />
                  Nouveau contrat
                </Link>
              </>
            }
          >
            {deals.length === 0 && contracts.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-border-strong px-4 py-3 text-[13px] leading-relaxed font-semibold text-muted-foreground">
                Pas encore de deal ni de contrat. Qualifie le besoin puis lance ton premier deal :
                une proposition envoyée rapporte +{XP_RULES.proposition} XP, un contrat signé +
                {XP_RULES.signature} XP.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {deals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/pipeline/${d.id}/modifier`}
                    className="flex items-center gap-3 rounded-[14px] border border-border p-3 transition-colors hover:border-border-strong hover:bg-navy-50/60"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-[12px]",
                        DEAL_TILE[d.stage] ?? DEAL_TILE.DECOUVERTE,
                      )}
                    >
                      <SquareKanban className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-extrabold">{d.titre}</span>
                      <span className="block text-xs font-semibold text-muted-foreground">
                        Deal · {getDealStageLabel(d.stage)} · {d.probabilite} %
                        {d.closeAttenduLe ? ` · closing ${fmtDate(d.closeAttenduLe)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-[15px] font-extrabold tabular-nums">
                        {formatCHFCompact(Number(d.montantPrevu))}
                      </span>
                      <span className="block text-[11px] font-semibold text-muted-foreground">
                        valeur an 1
                      </span>
                    </span>
                  </Link>
                ))}

                {contracts.map((c) => {
                  const renouv = getNextRenewalDate({
                    dateDebut: c.dateDebut,
                    dureeMois: c.dureeMois,
                    statut: c.statut,
                    reconductible: c.reconductible,
                  });
                  return (
                    <Link
                      key={c.id}
                      href={`/contrats/${c.id}`}
                      className="flex items-center gap-3 rounded-[14px] border border-border p-3 transition-colors hover:border-border-strong hover:bg-navy-50/60"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-navy-100 text-navy-700"
                      >
                        <FileText className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-extrabold">{c.numero}</span>
                          <ContractStatutBadge statut={c.statut} />
                        </span>
                        <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
                          Début {fmtDate(c.dateDebut)} · {c.dureeMois} mois
                          {renouv && (
                            <span className="text-gold-700">
                              {" "}
                              · renouvellement {fmtDate(renouv)}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-display text-[15px] font-extrabold tabular-nums">
                          {formatMoney(Number(c.valeurAn1), c.devise)}
                        </span>
                        {Number(c.montantMensuel) > 0 && (
                          <span className="block text-[11px] font-semibold text-muted-foreground tabular-nums">
                            {formatMoney(Number(c.montantMensuel), c.devise)} / mois
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Notes générales"
            icon={StickyNote}
            tone="gold"
            action={
              <Link
                href={`/prospects/${prospect.id}/modifier`}
                className="inline-flex h-8 items-center rounded-[10px] px-2 text-xs font-bold text-info-700 hover:bg-info-50"
              >
                Modifier
              </Link>
            }
          >
            {prospect.notesGenerales ? (
              <p className="text-sm leading-relaxed break-words whitespace-pre-line">
                {prospect.notesGenerales}
              </p>
            ) : (
              <p className="text-[13px] font-semibold text-muted-foreground">
                Aucune note pour l&apos;instant. Note ce que tu apprends au premier appel :
                décideur, besoin, budget.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title={`Factures · ${formatInt(clientInvoices.length)}`}
            icon={Receipt}
            tone="navy"
          >
            {clientInvoices.length === 0 ? (
              <p className="text-[13px] font-semibold text-muted-foreground">Aucune facture.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {clientInvoices.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-extrabold">{f.numero}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-bold",
                            INV_STATUT_COLOR[f.statut],
                          )}
                        >
                          {INV_STATUT_LABEL[f.statut]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {INV_TYPE_LABEL[f.type]} · émise le {fmtDate(f.dateEmission)} · échéance{" "}
                        {fmtDate(f.dateEcheance)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="font-display text-[15px] font-extrabold tabular-nums">
                        {formatMoney(Number(f.total), f.devise)}
                      </p>
                      <DocumentPreviewButton
                        url={`/api/factures-clients/${f.id}/pdf`}
                        filename={`${f.numero}.pdf`}
                        label="Voir"
                        className="h-9 rounded-[10px] px-3 text-xs"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Projets / tâches du client : inclut l'historique archivé */}
          <SectionCard
            title={`Projets / tâches · ${formatInt(dossiers.length)}`}
            icon={ClipboardList}
            tone="violet"
            action={
              <Link
                href="/dossiers"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <ClipboardList aria-hidden="true" />
                Gestion des projets
              </Link>
            }
          >
            {dossiers.length === 0 ? (
              <p className="text-[13px] font-semibold text-muted-foreground">
                Aucune tâche rattachée à ce client.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dossiers.map((d) => (
                  <li
                    key={d.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] border border-border p-3",
                      // L'historique passe en retrait visuel : il est là pour être
                      // consulté, pas pour attirer l'œil comme le travail en cours.
                      d.archive && "bg-ground opacity-80",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold">
                      {d.titre}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        d.statut === "TERMINE"
                          ? "bg-win-50 text-win-700"
                          : d.statut === "EN_COURS"
                            ? "bg-gold-50 text-gold-700"
                            : "bg-navy-50 text-navy-500",
                      )}
                    >
                      {getDossierStatutLabel(d.statut)}
                    </span>
                    {d.archive && (
                      <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-bold text-navy-500">
                        Archivée
                      </span>
                    )}
                    {d.nbDocuments > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <Paperclip aria-hidden="true" className="size-3" />
                        <span className="sr-only">Documents : </span>
                        {d.nbDocuments}
                      </span>
                    )}
                    {d.nbUpdates > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <MessageSquare aria-hidden="true" className="size-3" />
                        <span className="sr-only">Mises à jour : </span>
                        {d.nbUpdates}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-muted-foreground">
                      {d.assigneA.name.split(" ")[0]}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {d.termineLe
                        ? `Terminée le ${fmtDate(d.termineLe)}`
                        : d.echeance
                          ? `Échéance ${fmtDate(d.echeance)}`
                          : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Méta */}
          <SectionCard title="Infos de la fiche" icon={Info} tone="navy">
            <div className="flex flex-col gap-3 text-sm">
              {prochaineEcheance && (
                <div className="flex items-start gap-3 rounded-[14px] bg-gold-50 px-3.5 py-3">
                  <CalendarClock aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-gold-700" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-[0.08em] text-gold-700 uppercase">
                      Prochaine échéance
                    </p>
                    <p className="mt-0.5 font-extrabold text-foreground">
                      {fmtDate(prochaineEcheance.date)}{" "}
                      <span className="text-xs font-semibold text-gold-700">
                        ({relativeDays(prochaineEcheance.date, now).label})
                      </span>
                    </p>
                    <p className="text-xs font-semibold text-gold-700">{prochaineEcheance.label}</p>
                  </div>
                </div>
              )}
              <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
                <MetaRow label="Assignée à" value={prospect.assigneA?.name ?? "Personne"} />
                <MetaRow label="Créée le" value={fmtDate(prospect.createdAt)} />
                <MetaRow label="Dernière modification" value={fmtDate(prospect.updatedAt)} />
                {prospect.dernierAppelLe && (
                  <MetaRow
                    label={
                      prospect.dernierAppelLe.getTime() > nowMs ? "Rappel prévu" : "Dernier appel"
                    }
                    value={fmtDate(prospect.dernierAppelLe)}
                  />
                )}
                {prospect.noga && <MetaRow label="Code NOGA" value={prospect.noga} />}
              </dl>
              <p className="border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
                {formatInt(prospect._count.activities)} activités · {formatInt(prospect._count.deals)}{" "}
                deals · {formatInt(prospect._count.contracts)} contrats
              </p>
            </div>
          </SectionCard>

          {/* Outils LPD/RGPD : admin uniquement */}
          {isAdmin && (
            <GdprTools prospectId={prospect.id} raisonSociale={prospect.raisonSociale} />
          )}
        </div>
      </div>
    </div>
  );
}

function HeatPill({ heat }: { heat: LeadHeat }) {
  if (heat.kind === "client") return null;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full bg-ground px-2.5 text-xs font-extrabold",
        heat.textClass,
      )}
    >
      <FlameIcon hex={heat.hex} filled={heat.level >= 4} />
      {heat.label}
    </span>
  );
}

function FlameIcon({ hex, filled }: { hex: string; filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? hex : "none"}
      stroke={hex}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function ContactField({
  label,
  children,
  className,
  as = "div",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** `dl` : rendu en <dt>/<dd> (dans une liste de définitions). */
  as?: "div" | "dl";
}) {
  if (as === "dl") {
    return (
      <div className={cn("min-w-0", className)}>
        <dt className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </dt>
        <dd className="mt-0.5 min-w-0">{children}</dd>
      </div>
    );
  }
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-bold break-words">{value}</dd>
    </div>
  );
}

function ExternalSearch({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong bg-card px-3 text-xs font-bold text-foreground hover:bg-navy-50"
    >
      <Search aria-hidden="true" className="size-3" />
      {label}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}

