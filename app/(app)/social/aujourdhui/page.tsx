import Link from "next/link";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { SocialDailyView } from "@/components/social/social-daily-view";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  SOCIAL_STEPS,
  dateOnly,
  getDueSteps,
  isWeekend,
  type SocialStep,
} from "@/lib/social-sequence";

export const metadata = { title: "Social — Aujourd'hui" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SocialTodayPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;

  // Date sélectionnée (par défaut : aujourd'hui)
  const dateParam = typeof raw.date === "string" ? raw.date : null;
  const today = dateParam ? new Date(dateParam) : new Date();
  const todayOnly = dateOnly(today);

  // Filtre compte / responsable (admin)
  const accountFilter =
    typeof raw.accountId === "string" ? raw.accountId : null;

  // Charge tous les comptes accessibles + leurs prospects EN_COURS
  const accounts = await prisma.socialAccount.findMany({
    where: {
      actif: true,
      ...(user.role !== "ADMIN" ? { responsableId: user.id } : {}),
      ...(accountFilter ? { id: accountFilter } : {}),
    },
    include: {
      responsable: { select: { id: true, name: true } },
      prospects: {
        where: {
          statut: "EN_COURS",
          // Ne charge que les prospects dont la séquence a démarré
          dateDemarrage: { lte: todayOnly },
        },
        orderBy: { dateDemarrage: "asc" },
      },
    },
    orderBy: [{ reseau: "asc" }, { nom: "asc" }],
  });

  // Plafond journalier : ~10 prospects/compte/jour PAR étape (objectif de
  // charge MakeYourCom). On affiche les plus anciens d'abord (les prospects
  // sont déjà triés dateDemarrage asc) → chaque jour = liste finie et gérable,
  // et on avance dans le retard. Le reste s'affiche les jours suivants.
  const DAILY_CAP = 10;

  // Calcule les actions dues par étape pour chaque compte
  const byAccount = accounts.map((a) => {
    const full: Record<
      SocialStep,
      Array<{ id: string; nom: string; profilUrl: string; dateDemarrage: string }>
    > = { 0: [], 2: [], 4: [], 6: [] };
    for (const p of a.prospects) {
      const due = getDueSteps(
        p.dateDemarrage,
        {
          step0Done: p.step0Done,
          step2Done: p.step2Done,
          step4Done: p.step4Done,
          step6Done: p.step6Done,
        },
        todayOnly,
      );
      for (const s of due) {
        full[s].push({
          id: p.id,
          nom: p.nom,
          profilUrl: p.profilUrl,
          dateDemarrage: p.dateDemarrage.toISOString(),
        });
      }
    }
    // Applique le plafond par étape (plus anciens d'abord).
    const dueByStep = {
      0: full[0].slice(0, DAILY_CAP),
      2: full[2].slice(0, DAILY_CAP),
      4: full[4].slice(0, DAILY_CAP),
      6: full[6].slice(0, DAILY_CAP),
    } as Record<
      SocialStep,
      Array<{ id: string; nom: string; profilUrl: string; dateDemarrage: string }>
    >;
    const totalFull =
      full[0].length + full[2].length + full[4].length + full[6].length;
    const totalDue =
      dueByStep[0].length +
      dueByStep[2].length +
      dueByStep[4].length +
      dueByStep[6].length;
    return {
      id: a.id,
      nom: a.nom,
      reseau: a.reseau,
      responsable: a.responsable.name,
      dueByStep,
      totalDue,
      backlog: totalFull - totalDue, // en retard, reporté aux jours suivants
    };
  });

  const totalActions = byAccount.reduce((s, a) => s + a.totalDue, 0);
  const totalBacklog = byAccount.reduce((s, a) => s + a.backlog, 0);

  // Le social fait une pause le samedi et le dimanche : on n'affiche pas de
  // tâches le week-end, la séquence reprend automatiquement le lundi.
  const weekend = isWeekend(today);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Social — Aujourd'hui"
        description={
          weekend
            ? "Pause week-end — la séquence reprend lundi."
            : `${totalActions} action(s) à faire ${
                dateParam
                  ? `au ${todayOnly.toLocaleDateString("fr-CH")}`
                  : "aujourd'hui"
              }${
                totalBacklog > 0
                  ? ` · ${totalBacklog} en retard (reporté·es aux jours suivants)`
                  : ""
              }.`
        }
        actions={
          <>
            <Link
              href="/social/prospects"
              className={buttonVariants({ variant: "outline" })}
            >
              <Icon name="Users" className="mr-1.5 h-4 w-4" />
              Tous les prospects
            </Link>
            <Link
              href="/social/import"
              className={buttonVariants({ variant: "default" })}
            >
              <Icon name="Plus" className="mr-1.5 h-4 w-4" />
              Charger un mois
            </Link>
          </>
        }
      />

      {weekend ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-8 text-center">
          <span className="mx-auto block text-4xl">🌴</span>
          <p className="mt-2 text-base font-medium text-amber-900">
            Pause week-end
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Le social ne tourne pas le samedi et le dimanche. La séquence
            reprend automatiquement lundi — repose-toi&nbsp;!
          </p>
        </div>
      ) : byAccount.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun compte accessible. Demande à l&apos;admin de t&apos;en
          assigner un.
        </p>
      ) : totalActions === 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-8 text-center">
          <Icon
            name="Check"
            className="mx-auto h-10 w-10 text-emerald-600"
          />
          <p className="mt-2 text-base font-medium text-emerald-900">
            🎉 Tout est à jour
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Aucune action en attente sur les comptes accessibles.
          </p>
          <p className="mt-3 text-xs text-emerald-700">
            <Link
              href="/social/import"
              className="underline hover:no-underline"
            >
              Charger un nouveau lot de prospects
            </Link>
          </p>
        </div>
      ) : (
        <SocialDailyView
          accounts={byAccount}
          steps={SOCIAL_STEPS as unknown as SocialStep[]}
        />
      )}
    </div>
  );
}
