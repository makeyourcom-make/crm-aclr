import { PageHeader } from "@/components/page-header";
import { zWeekdayLong } from "@/components/call/zurich";
import { PhoningOwnerSwitcher } from "@/components/phoning/owner-switcher";
import {
  PhoningCockpit,
  type PhoningGame,
} from "@/components/phoning/phoning-cockpit";
import { prisma } from "@/lib/db";
import { getPlayerStats } from "@/lib/gamification";
import { firstNameOf } from "@/lib/gamification/rules";
import {
  getPhoningAgenda,
  getPhoningDayCalls,
  getPhoningQueue,
  resolvePhoningOwner,
} from "@/lib/queries/phoning";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Phoning" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Stats joueur (missions, XP du jour, record) ; le cockpit reste utilisable sans. */
async function loadGame(userId: string): Promise<PhoningGame | null> {
  try {
    const s = await getPlayerStats(userId);
    return {
      xpToday: s.xpToday,
      xpRecordDay: s.xpRecordDay,
      missions: s.missions,
      today: s.today,
    };
  } catch (err) {
    console.error("[phoning] getPlayerStats a échoué :", err);
    return null;
  }
}

export default async function PhoningPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const isAdmin = user.role === "ADMIN";

  // Admin : file d'un autre utilisateur actif via ?pour=<userId> (sinon la sienne).
  const teamUsers = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const requested = typeof raw.pour === "string" ? raw.pour : null;
  const ownerId = resolvePhoningOwner(
    user,
    requested && teamUsers.some((u) => u.id === requested) ? requested : null,
  );
  const owner = teamUsers.find((u) => u.id === ownerId);

  const [queue, dayCalls, agenda, game] = await Promise.all([
    getPhoningQueue(user, ownerId),
    getPhoningDayCalls(user.id),
    getPhoningAgenda(user.id),
    loadGame(user.id),
  ]);

  const ownerLabel = ownerId !== user.id && owner ? owner.name : null;
  const fileLabel =
    queue.counts.total === 0
      ? "file vide"
      : `${queue.counts.total} prospect${queue.counts.total > 1 ? "s" : ""} dans la file`;
  const detail = [
    queue.counts.rappels > 0 ? `${queue.counts.rappels} rappel${queue.counts.rappels > 1 ? "s" : ""} dû${queue.counts.rappels > 1 ? "s" : ""}` : null,
    queue.counts.chauds > 0 ? `${queue.counts.chauds} lead${queue.counts.chauds > 1 ? "s" : ""} chaud${queue.counts.chauds > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const today = zWeekdayLong(new Date());

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Phoning"
        rubrique="appels"
        description={
          <>
            <span className="capitalize">{today}</span> · {fileLabel}
            {detail ? ` · ${detail}` : ""}
          </>
        }
        actions={
          isAdmin && teamUsers.length > 1 ? (
            <PhoningOwnerSwitcher
              users={teamUsers}
              currentUserId={user.id}
              ownerId={ownerId}
            />
          ) : undefined
        }
      />

      <PhoningCockpit
        myFirstName={firstNameOf(user.name)}
        ownerLabel={ownerLabel}
        queue={queue}
        dayCalls={dayCalls}
        agenda={agenda}
        game={game}
      />
    </div>
  );
}
