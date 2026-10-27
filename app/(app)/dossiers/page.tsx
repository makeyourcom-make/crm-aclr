import { Archive, CheckCircle2, Clock, Flame, FolderKanban, Lightbulb, Users, UserCog, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { PlayerAvatar, toneForRole } from "@/components/arena/player-avatar";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { CreateDossierDialog } from "@/components/dossiers/create-dossier-dialog";
import { initialesDe } from "@/components/dossiers/dossier-tones";
import { DossiersBoard } from "@/components/dossiers/dossiers-board";
import { DossiersTabs } from "@/components/dossiers/dossiers-tabs";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { ARCHIVE_APRES_JOURS } from "@/lib/dossiers";
import { getDossiersBoard } from "@/lib/queries/dossiers";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Gestion des projets" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DossiersPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  // Les tâches terminées depuis > 7 jours sortent du tableau ; ce paramètre les
  // ramène, pour qu'une tâche sans client rattaché ne devienne jamais
  // inaccessible (la fiche client, elle, montre toujours tout).
  const avecArchives = raw.archives === "1";

  // Espaces : un commercial ne voit QUE le sien (RLS dans getDossiersBoard).
  // L'admin choisit l'espace via ?espace= : un userId (ex. le sien = « Interne »),
  // ou « tous ». Par défaut l'admin arrive sur son propre espace (le plus focalisé).
  const isAdmin = user.role === "ADMIN";
  const espaceParam = typeof raw.espace === "string" ? raw.espace : undefined;
  const assigneAId: string | undefined = !isAdmin ? undefined : espaceParam === "tous" ? undefined : (espaceParam ?? user.id);

  const [board, users] = await Promise.all([
    getDossiersBoard(user, assigneAId, avecArchives),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Espace actuellement affiché (pour surligner le bon onglet).
  const espaceActif = isAdmin ? (espaceParam ?? user.id) : user.id;
  const archSuffix = avecArchives ? "&archives=1" : "";
  // Le lien « archives » garde l'espace choisi (admin).
  const espaceQs = isAdmin && espaceParam ? `espace=${encodeURIComponent(espaceParam)}` : "";
  // On n'affiche l'assigné sur les cartes que dans la vue « Tous » (admin) :
  // partout ailleurs on est déjà dans l'espace d'une seule personne, donc le
  // nom est redondant et mange de la place.
  const showAssignee = isAdmin && espaceActif === "tous";

  // Tableau de bord du kanban (données réelles du tableau affiché).
  const maintenant = new Date();
  const tous = board.columns.flatMap((c) => c.dossiers);
  const vivants = tous.filter((d) => d.statut !== "TERMINE");
  const enRetard = vivants.filter((d) => d.echeance && new Date(d.echeance) < maintenant).length;
  const urgents = vivants.filter((d) => d.priorite === "HAUTE").length;
  const terminesRecents = tous.filter((d) => d.statut === "TERMINE" && !d.archive).length;
  const usersSelect = users.map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="projets"
        title="Gestion des projets"
        description={`${board.total} projet${board.total > 1 ? "s" : ""} en cours de suivi${
          avecArchives ? " (archives incluses)" : ""
        }`}
        actions={<CreateDossierDialog users={usersSelect} currentUserId={user.id} />}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <DossiersTabs />
        {isAdmin && (
          <div role="group" aria-label="Espace" className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Espace :</span>
            <SpaceTab
              href={`/dossiers?espace=${user.id}${archSuffix}`}
              label={`Interne · ${user.name.split(" ")[0]}`}
              icon={UserCog}
              active={espaceActif === user.id}
            />
            {users
              .filter((u) => u.id !== user.id)
              .map((u) => (
                <SpaceTab
                  key={u.id}
                  href={`/dossiers?espace=${u.id}${archSuffix}`}
                  label={u.name.split(" ")[0]!}
                  avatar={{ initials: initialesDe(u.name), tone: toneForRole(u.role) }}
                  active={espaceActif === u.id}
                />
              ))}
            <SpaceTab
              href={`/dossiers?espace=tous${archSuffix}`}
              label="Tous"
              icon={Users}
              active={espaceActif === "tous"}
            />
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ScoreTile icon={FolderKanban} tone="violet" value={vivants.length} label={vivants.length > 1 ? "projets actifs" : "projet actif"} />
        <ScoreTile icon={Clock} tone="red" value={enRetard} label="échéance dépassée" />
        <ScoreTile icon={Flame} tone="coral" value={urgents} label="priorité haute" />
        <ScoreTile
          icon={CheckCircle2}
          tone="green"
          value={terminesRecents}
          label={`terminé${terminesRecents > 1 ? "s" : ""} ces ${ARCHIVE_APRES_JOURS} derniers jours`}
        />
      </div>

      {(board.nbArchivees > 0 || avecArchives) && (
        <div className="mb-3">
          <Link
            href={avecArchives ? `/dossiers${espaceQs ? `?${espaceQs}` : ""}` : `/dossiers?${espaceQs ? `${espaceQs}&` : ""}archives=1`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-1 text-[13px] font-bold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <Archive aria-hidden="true" className="size-4" />
            {avecArchives
              ? "Masquer les projets archivés"
              : `Voir les ${board.nbArchivees} projet${board.nbArchivees > 1 ? "s" : ""} archivé${board.nbArchivees > 1 ? "s" : ""}`}
          </Link>
        </div>
      )}

      <DossiersBoard initialData={board} users={usersSelect} showAssignee={showAssignee} />

      <p className="mx-auto mt-5 flex max-w-3xl items-start justify-center gap-2 text-center text-xs text-muted-foreground">
        <Lightbulb aria-hidden="true" className="mt-px size-4 shrink-0 text-gold-700" />
        <span>
          Glisse une carte d&apos;une colonne à l&apos;autre pour changer son avancement. Clique une carte pour éditer
          le détail, la confier à quelqu&apos;un d&apos;autre, ajouter un suivi ou la terminer. Une tâche terminée depuis
          plus de {ARCHIVE_APRES_JOURS} jours quitte le tableau et reste consultable depuis la fiche du client.
        </span>
      </p>
    </div>
  );
}

function ScoreTile({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon;
  tone: Tone;
  value: number;
  label: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[16px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(14,25,54,0.04)]">
      <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-[12px]", t.bg, t.text)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className={cn("score-number text-[28px]", value > 0 && tone === "red" ? t.text : "text-foreground")}>{value}</p>
        <p className="mt-0.5 text-xs leading-tight font-bold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SpaceTab({
  href,
  label,
  icon: Icon,
  avatar,
  active,
}: {
  href: string;
  label: string;
  icon?: LucideIcon;
  avatar?: { initials: string; tone: ReturnType<typeof toneForRole> };
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border text-[13px] font-bold transition-colors",
        avatar ? "pr-3.5 pl-1.5" : "px-3.5",
        active ? "border-navy-700 bg-navy-700 text-white" : "border-border-strong bg-card text-foreground hover:bg-navy-50",
      )}
    >
      {avatar && <PlayerAvatar initials={avatar.initials} tone={avatar.tone} size={26} />}
      {Icon && <Icon aria-hidden="true" className="size-4" />}
      {label}
    </Link>
  );
}
