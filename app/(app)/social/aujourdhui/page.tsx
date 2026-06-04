import Link from "next/link";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { SocialDailyView } from "@/components/social/social-daily-view";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  STEP_LABELS,
  SOCIAL_STEPS,
  dateOnly,
  getDueSteps,
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

  // Calcule les actions dues par étape pour chaque compte
  const byAccount = accounts.map((a) => {
    const dueByStep: Record<
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
        dueByStep[s].push({
          id: p.id,
          nom: p.nom,
          profilUrl: p.profilUrl,
          dateDemarrage: p.dateDemarrage.toISOString(),
        });
      }
    }
    return {
      id: a.id,
      nom: a.nom,
      reseau: a.reseau,
      responsable: a.responsable.name,
      dueByStep,
      totalDue:
        dueByStep[0].length +
        dueByStep[2].length +
        dueByStep[4].length +
        dueByStep[6].length,
    };
  });

  const totalActions = byAccount.reduce((s, a) => s + a.totalDue, 0);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Social — Aujourd'hui"
        description={`${totalActions} action(s) due(s) ${
          dateParam ? `au ${todayOnly.toLocaleDateString("fr-CH")}` : "aujourd'hui"
        }.`}
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

      {byAccount.length === 0 ? (
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
          stepLabels={STEP_LABELS}
          steps={SOCIAL_STEPS as unknown as SocialStep[]}
        />
      )}
    </div>
  );
}
