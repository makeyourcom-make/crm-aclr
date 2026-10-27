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

import { HeroPanel, PlayerAvatar, StreakPill, formatInt } from "@/components/arena";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { IconPageHeader } from "@/components/common/icon-page-header";
import { PageShell } from "@/components/common/page-shell";
import { ProfileForm } from "@/components/parametres/profile-form";
import { SettingsForm } from "@/components/parametres/settings-form";
import { prisma } from "@/lib/db";
import { formatCHFCompact } from "@/lib/format";
import { getPlayerHeader } from "@/lib/gamification";
import type { PlayerHeader } from "@/lib/gamification/rules";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

/** Résultats du collaborateur (dédupliqués avec ceux du layout via React cache). */
async function loadResults(userId: string): Promise<PlayerHeader | null> {
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
  const [setting, userFull, results] = await Promise.all([
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
    loadResults(user.id),
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

      {/* Carte résultats (données réelles : série, mois en cours) */}
      {results && (
        <HeroPanel aria-label="Tes résultats" className="mb-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex min-w-0 flex-[1_1_260px] items-center gap-4">
              <PlayerAvatar
                initials={results.initials}
                tone={user.role === "ADMIN" ? "navy" : "coral"}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-extrabold tracking-[-0.02em]">
                  {results.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StreakPill days={results.streak} variant="dark" />
                  <span className="text-xs font-semibold text-navy-200 tabular-nums">
                    {formatInt(results.today.appels)} / {formatInt(results.dailyTargets.appels)} appels aujourd&apos;hui
                  </span>
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-[1_1_240px]">
              <span className="text-[11px] font-bold tracking-[0.08em] text-navy-300 uppercase">
                Ce mois
              </span>
              <dl className="mt-2 grid grid-cols-3 gap-3">
                <MonthStat label="CA signé" value={formatCHFCompact(results.month.caSigne)} />
                <MonthStat label="Contrats" value={formatInt(results.month.contratsSignes)} />
                <MonthStat label="RDV pris" value={formatInt(results.month.rdvPris)} />
              </dl>
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

function MonthStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-navy-200">{label}</dt>
      <dd className="truncate font-display text-base font-extrabold text-white tabular-nums">{value}</dd>
    </div>
  );
}
