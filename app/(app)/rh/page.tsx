import { ChevronRight, FileText, UserCheck, UserX, Users } from "lucide-react";
import Link from "next/link";

import { formatXp } from "@/components/arena/format";
import { LevelPill, StatusPill, StreakPill } from "@/components/arena/pills";
import { PlayerAvatar, toneForRole } from "@/components/arena/player-avatar";
import { StatTile } from "@/components/arena/stat-tile";
import type { Tone } from "@/components/arena/tones";
import { PageHeader } from "@/components/page-header";
import { formatCHF } from "@/lib/format";
import { getPlayerHeader } from "@/lib/gamification";
import { initialsOf, type PlayerHeader } from "@/lib/gamification/rules";
import { listEmployees } from "@/lib/queries/hr";
import { formatDateCH, formatPercentRate } from "@/lib/queries/objectifs-pace";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Collaborateurs" };
export const dynamic = "force-dynamic";

const CONTRAT_LABEL: Record<string, string> = {
  CDI: "CDI",
  CDD: "CDD",
  MANDAT: "Mandat",
  STAGE: "Stage",
  ESSAI: "Essai",
};

const CONTRAT_TONE: Record<string, Tone> = {
  CDI: "green",
  CDD: "gold",
  MANDAT: "blue",
  STAGE: "violet",
  ESSAI: "navy",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  COMMERCIAL: "Commerciale",
};

async function safeHeader(userId: string): Promise<PlayerHeader | null> {
  try {
    return await getPlayerHeader(userId);
  } catch (err) {
    console.error("[rh] getPlayerHeader a échoué :", err);
    return null;
  }
}

export default async function RhPage() {
  await requireAdmin();
  const employees = await listEmployees();

  const actifs = employees.filter((e) => e.isActive);
  const inactifs = employees.filter((e) => !e.isActive);
  const commerciales = actifs.filter((e) => e.role === "COMMERCIAL");
  const docs = employees.reduce((s, e) => s + e._count.documentsRH, 0);

  const headers = new Map<string, PlayerHeader | null>(
    await Promise.all(actifs.map(async (e) => [e.id, await safeHeader(e.id)] as const)),
  );

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Collaborateurs"
        description={`${actifs.length} collaborateur(s) actif(s)${inactifs.length > 0 ? ` · ${inactifs.length} sorti(s)` : ""}.`}
      />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Actifs" value={actifs.length} icon={UserCheck} tone="green" sub="peuvent se connecter" />
          <StatTile label="Commerciales" value={commerciales.length} icon={Users} tone="coral" sub="en activité" />
          <StatTile label="Sortis" value={inactifs.length} icon={UserX} tone="navy" sub="comptes désactivés" />
          <StatTile label="Documents RH" value={docs} icon={FileText} tone="blue" sub="contrats, fiches, pièces" />
        </div>

        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((e) => {
            const header = e.isActive ? (headers.get(e.id) ?? null) : null;
            return (
              <li key={e.id} className="min-w-0">
                <Link
                  href={`/rh/${e.id}`}
                  className={cn(
                    "group flex h-full min-w-0 flex-col gap-3.5 rounded-[20px] border border-border bg-card p-4 shadow-arena transition-[transform,box-shadow,border-color,opacity] duration-200 hover:-translate-y-0.5 hover:border-border-strong sm:p-5",
                    !e.isActive && "opacity-70 hover:opacity-100",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <PlayerAvatar initials={initialsOf(e.name)} tone={toneForRole(e.role)} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-extrabold text-foreground">{e.name}</p>
                      <p className="truncate text-xs font-medium text-muted-foreground">{e.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill tone={e.role === "ADMIN" ? "navy" : "coral"} dot={false}>
                      {ROLE_LABEL[e.role] ?? e.role}
                    </StatusPill>
                    {e.typeContrat && (
                      <StatusPill tone={CONTRAT_TONE[e.typeContrat] ?? "navy"}>
                        {CONTRAT_LABEL[e.typeContrat] ?? e.typeContrat}
                      </StatusPill>
                    )}
                    {!e.isActive && <StatusPill tone="red">Sorti</StatusPill>}
                  </div>

                  {header && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <LevelPill level={header.level} />
                      <StreakPill days={header.streak} />
                      <span className="text-xs font-bold text-muted-foreground tabular-nums">
                        {formatXp(header.level.xp)}
                      </span>
                    </div>
                  )}

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                    <Cell label="Activité" value={`${e.pourcentageActivite ?? 100} %`} />
                    {e.dateEntree && <Cell label="Entrée" value={formatDateCH(e.dateEntree)} />}
                    {e.dateSortie && <Cell label="Sortie" value={formatDateCH(e.dateSortie)} />}
                    {e.salaireBase != null && Number(e.salaireBase) > 0 && (
                      <Cell label="Salaire base" value={`${formatCHF(Number(e.salaireBase))} / mois`} />
                    )}
                    {e.role === "COMMERCIAL" && (
                      <Cell label="Garantie" value={formatCHF(Number(e.garantieMensuelle))} />
                    )}
                    {e.role === "COMMERCIAL" && (
                      <Cell label="Commission" value={formatPercentRate(Number(e.tauxCommissionSignature))} />
                    )}
                  </dl>

                  <div className="mt-auto flex items-center gap-3 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <FileText aria-hidden="true" className="size-3.5" />
                      {e._count.documentsRH} doc(s)
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 font-bold text-info-700">
                      Voir la fiche
                      <ChevronRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="text-xs font-medium text-muted-foreground">
          Pour ajouter un nouveau collaborateur, crée d&apos;abord son compte utilisateur. Cette
          page sert à gérer son dossier RH une fois le compte créé.
        </p>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{label}</dt>
      <dd className="truncate text-[13px] font-bold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
