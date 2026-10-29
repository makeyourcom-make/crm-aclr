import { ArrowRight, GitMerge } from "lucide-react";
import Link from "next/link";

import type { ProspectStatut } from "@prisma/client";

import { EmptyState, SectionCard, StatusPill, formatInt } from "@/components/arena";
import { MergeReviewActions } from "@/components/prospects/merge-review-actions";
import { ProspectStatutBadge } from "@/components/prospects/prospect-statut-badge";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Fusions à valider" };
export const dynamic = "force-dynamic";

const PROSPECT_SELECT = {
  id: true,
  raisonSociale: true,
  ville: true,
  statut: true,
  _count: { select: { activities: true, deals: true, contracts: true } },
} as const;

/**
 * File de validation des demandes de fusion de doublons. Admin uniquement :
 * chaque demande montre la fiche conservée (cible) et le doublon (source) avec
 * leurs volumes de données, qui a demandé, la note, et les actions valider/refuser.
 */
export default async function FusionsPage() {
  await requireAdmin();

  const demandes = await prisma.prospectMerge.findMany({
    where: { statut: "EN_ATTENTE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      note: true,
      demandeParId: true,
      cible: { select: PROSPECT_SELECT },
      source: { select: PROSPECT_SELECT },
    },
  });

  // Résolution des noms des demandeurs (demandeParId est un simple champ texte).
  const demandeurIds = [
    ...new Set(demandes.map((d) => d.demandeParId).filter((v): v is string => !!v)),
  ];
  const demandeurs = demandeurIds.length
    ? await prisma.user.findMany({
        where: { id: { in: demandeurIds } },
        select: { id: true, name: true },
      })
    : [];
  const nomParId = new Map(demandeurs.map((u) => [u.id, u.name]));

  const dtf = new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Fusions à valider"
        rubrique="leads"
        description={
          demandes.length > 0
            ? `${formatInt(demandes.length)} demande${demandes.length > 1 ? "s" : ""} de fusion en attente`
            : "Demandes de fusion de doublons d'entreprises"
        }
        actions={
          <Link
            href="/prospects"
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-navy-50 px-3 text-xs font-bold text-foreground hover:bg-navy-100"
          >
            Retour aux entreprises
          </Link>
        }
      />

      {demandes.length === 0 ? (
        <EmptyState
          icon={GitMerge}
          tone="green"
          title="Aucune fusion en attente."
          description="Les demandes de fusion de doublons envoyées par l'équipe apparaîtront ici."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {demandes.map((d) => {
            const demandeur = d.demandeParId ? nomParId.get(d.demandeParId) : null;
            return (
              <SectionCard
                key={d.id}
                title={`${d.source.raisonSociale} → ${d.cible.raisonSociale}`}
                icon={GitMerge}
                tone="violet"
                description={`Demandée le ${dtf.format(d.createdAt)}${demandeur ? ` par ${demandeur}` : ""}`}
              >
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <FicheCard
                      label="On fusionne"
                      roleLabel="Doublon"
                      roleTone="coral"
                      p={d.source}
                    />
                    <span
                      aria-hidden="true"
                      className="mx-auto flex size-9 items-center justify-center rounded-full bg-navy-50 text-navy-500 md:mx-0"
                    >
                      <ArrowRight className="size-[18px]" />
                    </span>
                    <FicheCard
                      label="On garde"
                      roleLabel="Fiche conservée"
                      roleTone="green"
                      p={d.cible}
                    />
                  </div>

                  {d.note && (
                    <p className="rounded-[12px] border border-border bg-ground px-3.5 py-2.5 text-[13px] leading-relaxed">
                      <span className="font-bold text-muted-foreground">Note : </span>
                      {d.note}
                    </p>
                  )}

                  <p className="text-xs font-semibold text-muted-foreground">
                    Toutes les données du doublon (activités, deals, contrats, factures, tâches...)
                    seront déplacées dans la fiche conservée. Le doublon est conservé, marqué
                    « fusionné », jamais supprimé.
                  </p>

                  <MergeReviewActions
                    mergeId={d.id}
                    cibleRaisonSociale={d.cible.raisonSociale}
                    sourceRaisonSociale={d.source.raisonSociale}
                  />
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FicheCard({
  label,
  roleLabel,
  roleTone,
  p,
}: {
  label: string;
  roleLabel: string;
  roleTone: "coral" | "green";
  p: {
    id: string;
    raisonSociale: string;
    ville: string | null;
    statut: ProspectStatut;
    _count: { activities: number; deals: number; contracts: number };
  };
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </span>
        <StatusPill tone={roleTone}>{roleLabel}</StatusPill>
      </div>
      <Link
        href={`/prospects/${p.id}`}
        className="mt-1.5 block truncate font-display text-[17px] font-extrabold tracking-[-0.01em] hover:underline"
      >
        {p.raisonSociale}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        {p.ville && <span className="font-semibold">{p.ville}</span>}
        <ProspectStatutBadge statut={p.statut} />
      </div>
      <p className="mt-2 text-xs font-semibold text-muted-foreground tabular-nums">
        {formatInt(p._count.activities)} activité{p._count.activities > 1 ? "s" : ""} ·{" "}
        {formatInt(p._count.deals)} deal{p._count.deals > 1 ? "s" : ""} ·{" "}
        {formatInt(p._count.contracts)} contrat{p._count.contracts > 1 ? "s" : ""}
      </p>
    </div>
  );
}
