import {
  Building2,
  CalendarSync,
  ChevronRight,
  Mail,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import {
  HeroPanel,
  LevelPill,
  PlayerAvatar,
  StreakPill,
  XpBar,
  XpPill,
  formatInt,
} from "@/components/arena";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { IconPageHeader } from "@/components/common/icon-page-header";
import { PageShell } from "@/components/common/page-shell";
import { ProfileForm } from "@/components/parametres/profile-form";
import { SettingsForm } from "@/components/parametres/settings-form";
import { prisma } from "@/lib/db";
import { getPlayerHeader } from "@/lib/gamification";
import type { PlayerHeader } from "@/lib/gamification/rules";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

/** En-tête joueur (dédupliqué avec celui du layout via React cache). */
async function loadPlayer(userId: string): Promise<PlayerHeader | null> {
  try {
    return await getPlayerHeader(userId);
  } catch {
    return null;
  }
}

const SHORTCUTS: {
  href: string;
  title: string;
  text: string;
  icon: LucideIcon;
  tone: Tone;
}[] = [
  {
    href: "/parametres/signatures",
    title: "Signatures email",
    text: "Crée et personnalise tes signatures, ajoutées automatiquement à tes emails.",
    icon: Mail,
    tone: "teal",
  },
  {
    href: "/settings/securite",
    title: "Sécurité",
    text: "Mot de passe et double authentification (2FA) de ton compte.",
    icon: ShieldCheck,
    tone: "green",
  },
  {
    href: "/settings/calendar",
    title: "Synchroniser l'agenda",
    text: "Google Agenda, CalDAV (Infomaniak) ou abonnement iCalendar.",
    icon: CalendarSync,
    tone: "gold",
  },
];

export default async function ParametresPage() {
  const user = await requireUser();
  const [setting, userFull, player] = await Promise.all([
    prisma.setting.findFirst(),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        iban: true,
        telephone: true,
        adresse: true,
      },
    }),
    loadPlayer(user.id),
  ]);

  return (
    <PageShell width="form">
      <IconPageHeader
        icon={Settings}
        tone="navy"
        title="Paramètres"
        description={
          user.role === "ADMIN"
            ? "Profil personnel + coordonnées ACLR Sàrl + paramètres financiers par défaut."
            : "Mon profil personnel (nom, IBAN, coordonnées)."
        }
      />

      {/* Carte joueur (données réelles du moteur de jeu) */}
      {player && (
        <HeroPanel aria-label="Ta carte joueur" className="mb-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex min-w-0 flex-[1_1_260px] items-center gap-4">
              <PlayerAvatar
                initials={player.initials}
                tone={user.role === "ADMIN" ? "navy" : "coral"}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-extrabold tracking-[-0.02em]">
                  {player.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <LevelPill level={player.level} variant="dark" />
                  <StreakPill days={player.streak} variant="dark" />
                  <XpPill xp={player.xpToday} label="aujourd'hui" variant="dark" />
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-[1_1_240px]">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold tracking-[0.08em] text-navy-300 uppercase">
                  Progression
                </span>
                <span className="text-[13px] font-semibold text-navy-200 tabular-nums">
                  <strong className="font-display text-base font-extrabold text-white">
                    {formatInt(player.level.xp)}
                  </strong>
                  {player.level.nextXp !== null && ` / ${formatInt(player.level.nextXp)}`} XP
                </span>
              </div>
              <XpBar
                pct={player.level.pct}
                className="h-2.5 bg-navy-500"
                label={`Progression vers le niveau suivant : ${player.level.pct} %`}
              />
              <p className="mt-2 text-xs font-semibold text-navy-200">
                {player.level.xpToNext !== null && player.level.nextName
                  ? `${formatInt(player.level.xpToNext)} XP avant ${player.level.nextName}`
                  : "Niveau maximum atteint : Légende"}
              </p>
            </div>
          </div>
        </HeroPanel>
      )}

      {userFull && (
        <div className="mb-6">
          <ProfileForm user={userFull} />
        </div>
      )}

      {/* Raccourcis de configuration personnelle */}
      <ul className="mb-8 grid gap-3 sm:grid-cols-3">
        {SHORTCUTS.map((s) => {
          const t = TONE_CLASSES[s.tone];
          return (
            <li key={s.href} className="min-w-0">
              <Link
                href={s.href}
                className="group flex h-full items-start gap-3 rounded-[16px] border border-border bg-card p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-arena"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[12px]",
                    t.bg,
                    t.text,
                  )}
                >
                  <s.icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-extrabold">
                    {s.title}
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 text-subtle transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {s.text}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {user.role === "ADMIN" && (
        <>
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            <Building2 aria-hidden="true" className="size-4" />
            Paramètres ACLR Sàrl (admin)
          </h2>
          <SettingsForm setting={setting} />
        </>
      )}
    </PageShell>
  );
}
