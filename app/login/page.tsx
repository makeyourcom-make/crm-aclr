import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { LEVELS, XP_RULES } from "@/lib/gamification/rules";
import { formatNumber } from "@/lib/format";

import { LoginForm } from "./form";

export const metadata: Metadata = {
  title: "Connexion",
};

/** Actions phares du barème (constantes réelles du moteur de jeu). */
const XP_HIGHLIGHTS: { label: string; xp: number }[] = [
  { label: "Appel passé", xp: XP_RULES.appel },
  { label: "RDV pris", xp: XP_RULES.rdvPris },
  { label: "Proposition envoyée", xp: XP_RULES.proposition },
  { label: "Contrat signé", xp: XP_RULES.signature },
];

/**
 * Page de connexion MYC Arena : panneau de marque navy (logo MAKE YOUR COM ·
 * Arena, règles du jeu réelles) + formulaire clair et accessible.
 * La logique d'authentification (LoginForm → loginAction) est inchangée.
 */
export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-ground text-foreground lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Panneau de marque */}
      <section
        aria-label="MAKE YOUR COM Arena"
        className="relative isolate flex flex-col overflow-hidden bg-gradient-navy px-5 pt-6 pb-8 text-white sm:px-10 sm:pt-8 sm:pb-10 lg:min-h-dvh lg:px-14 lg:py-12"
      >
        {/* Décor discret (cercles coral / violet, comme le Kit) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-48 -right-40 -z-10 size-[560px] rounded-full border-[72px] border-coral-400/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-36 -left-24 -z-10 size-80 rounded-full border-[44px] border-lvl-500/15"
        />

        <Logo variant="wordmark" tone="dark" size={22} />

        <div className="mt-7 flex flex-col gap-5 sm:mt-10 lg:my-auto lg:gap-7">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-navy-200">
            <span aria-hidden="true" className="size-2 rounded-full bg-coral-400" />
            CRM ACLR Sàrl · accès réservé à l&apos;équipe
          </span>

          <p className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] sm:text-[44px] lg:text-[52px]">
            Chaque appel compte.{" "}
            <span className="text-coral-400">Chaque RDV rapporte.</span>
          </p>

          <p className="max-w-xl text-[15px] leading-relaxed text-navy-200">
            Connecte-toi pour retrouver ta journée, tes missions et ton score.
            Chaque action du CRM te fait gagner des XP.
          </p>

          {/* Barème : actions phares */}
          <ul
            aria-label="Exemples d'actions qui rapportent des XP"
            className="hidden grid-cols-2 gap-2.5 sm:grid lg:max-w-xl"
          >
            {XP_HIGHLIGHTS.map((r) => (
              <li
                key={r.label}
                className="flex items-center justify-between gap-3 rounded-[14px] border border-white/12 bg-white/[0.06] px-3.5 py-3"
              >
                <span className="text-[13px] font-semibold text-navy-200">
                  {r.label}
                </span>
                <span className="shrink-0 rounded-full bg-gold-500 px-2.5 py-1 text-xs font-extrabold text-navy-700 tabular-nums">
                  +{formatNumber(r.xp)} XP
                </span>
              </li>
            ))}
          </ul>

          {/* Échelle des niveaux */}
          <div className="hidden lg:block">
            <p className="mb-2.5 text-[11px] font-bold tracking-[0.08em] text-navy-300 uppercase">
              5 niveaux, de Rookie à Légende
            </p>
            <ol className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <li
                  key={l.level}
                  className="inline-flex items-center gap-2 rounded-full bg-navy-700/70 px-3 py-1.5 text-xs font-bold text-lvl-200 ring-1 ring-white/10 ring-inset"
                >
                  <span className="font-display text-sm font-extrabold text-white">
                    {l.level}
                  </span>
                  {l.name}
                  <span className="font-semibold text-navy-300 tabular-nums">
                    {formatNumber(l.minXp)} XP
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <p className="mt-8 hidden text-xs font-semibold text-navy-300 lg:block">
          MakeYourCom · ACLR Sàrl
        </p>
      </section>

      {/* Formulaire */}
      <section className="flex items-start justify-center px-4 py-8 sm:px-6 sm:py-12 lg:items-center">
        <div className="w-full max-w-md">
          <div className="rounded-[20px] border border-border bg-card p-6 shadow-arena sm:p-8">
            <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em]">
              Connexion
            </h1>
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">
              Bienvenue, entre tes identifiants pour accéder au CRM.
            </p>

            <div className="mt-6">
              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs font-medium text-muted-foreground">
            Application interne · accès réservé.
          </p>
        </div>
      </section>
    </main>
  );
}
