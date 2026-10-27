import Link from "next/link";
import { FilePlus2, Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PipelineViewSwitcher } from "@/components/pipeline/pipeline-view-switcher";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { firstNameOf } from "@/lib/gamification/rules";
import { getPipeline, getPipelineScoreboard } from "@/lib/queries/deals";
import { DealListParamsSchema } from "@/lib/schemas/deal";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Mois affiché = mois des données : getPipeline / getPipelineScoreboard
// découpent le mois en heure locale du serveur (new Date(y, m, 1)), donc pas
// de timeZone forcé ici (sinon « novembre » sur des chiffres d'octobre la
// nuit du 31 au 1er sur un serveur UTC).
const MONTH_FMT = new Intl.DateTimeFormat("fr-CH", { month: "long" });
const DM_FMT = new Intl.DateTimeFormat("fr-CH", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Zurich",
});

export default async function PipelinePage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const isAdmin = user.role === "ADMIN";

  // Côté admin : défaut "Toute l'équipe" (vue de pilotage globale).
  // Le sélecteur permet de filtrer sur chaque collaborateur.
  // Côté commercial : RLS appliquée côté query, ce param est ignoré.
  const explicitAssigneAId =
    typeof raw.assigneAId === "string" ? raw.assigneAId : undefined;
  const effectiveAssigneAId = isAdmin ? explicitAssigneAId : undefined;

  const params = DealListParamsSchema.parse({
    ...raw,
    assigneAId: effectiveAssigneAId ?? raw.assigneAId,
  });

  const [pipeline, teamUsers, scoreboard] = await Promise.all([
    getPipeline(user, params),
    isAdmin
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    getPipelineScoreboard(user, effectiveAssigneAId),
  ]);

  // Vue active : libellés du sous-titre et du héros
  const viewedUser =
    effectiveAssigneAId && effectiveAssigneAId !== user.id
      ? teamUsers.find((u) => u.id === effectiveAssigneAId)
      : null;
  let viewLabel: string;
  let view: { eyebrow: string; objPhrase: string };
  if (isAdmin && !effectiveAssigneAId) {
    viewLabel = "Toute l'équipe";
    view = {
      eyebrow: "Tableau de chasse de l'équipe",
      objPhrase: "l'objectif de l'équipe",
    };
  } else if (viewedUser) {
    const first = firstNameOf(viewedUser.name);
    viewLabel = `Pipeline de ${viewedUser.name}`;
    view = {
      eyebrow: `Tableau de chasse de ${first}`,
      objPhrase: `l'objectif de ${first}`,
    };
  } else if (isAdmin && effectiveAssigneAId && effectiveAssigneAId !== user.id) {
    viewLabel = "Pipeline d'un collaborateur";
    view = { eyebrow: "Tableau de chasse", objPhrase: "l'objectif" };
  } else {
    viewLabel = "Mon pipeline";
    view = { eyebrow: "Ton tableau de chasse", objPhrase: "ton objectif" };
  }

  // Mois courant et remise à zéro des colonnes Signé / Perdu (le 1er).
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysToReset = Math.max(
    1,
    Math.ceil((nextMonth.getTime() - now.getTime()) / 86_400_000),
  );
  const monthLabel = MONTH_FMT.format(now);
  const resetLabel = DM_FMT.format(nextMonth);

  const activeCount = pipeline.columns
    .filter((c) => c.stage !== "SIGNE" && c.stage !== "PERDU")
    .reduce((s, c) => s + c.deals.length, 0);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="pipeline"
        title="Pipeline"
        description={`${viewLabel} · ${activeCount} ${activeCount >= 2 ? "deals actifs" : "deal actif"} · ${monthLabel} ${now.getFullYear()}`}
        actions={
          <>
            <Link
              href="/contrats/nouveau"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <FilePlus2 aria-hidden="true" />
              Nouveau contrat
            </Link>
            <Link
              href="/pipeline/nouveau"
              className={buttonVariants({ variant: "default", size: "lg" })}
            >
              <Plus aria-hidden="true" strokeWidth={2.4} />
              Nouveau deal
            </Link>
          </>
        }
      />

      <PipelineBoard
        initialData={pipeline}
        scoreboard={scoreboard}
        isAdmin={isAdmin}
        currentUserId={user.id}
        nowIso={now.toISOString()}
        monthLabel={monthLabel}
        resetLabel={resetLabel}
        daysToReset={daysToReset}
        view={view}
        viewSwitcher={
          isAdmin && teamUsers.length > 1 ? (
            <PipelineViewSwitcher
              users={teamUsers}
              currentUserId={user.id}
              currentUserName={user.name}
              activeAssigneAId={effectiveAssigneAId}
            />
          ) : undefined
        }
      />
    </div>
  );
}
