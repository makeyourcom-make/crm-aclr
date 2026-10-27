import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";

import { LoginForm } from "./form";

export const metadata: Metadata = {
  title: "Connexion",
};

/** Ce que l'équipe retrouve dans le CRM (chiffres réels, aucun point). */
const HIGHLIGHTS: { label: string; detail: string }[] = [
  { label: "Ta journée", detail: "Appels, RDV pris, objectifs du jour" },
  { label: "Ton pipeline", detail: "Propositions et deals en CHF" },
  { label: "Tes contrats", detail: "Signatures et CA signé du mois" },
  { label: "Tes commissions", detail: "Ce que tu as gagné, en CHF" },
];

/**
 * Page de connexion : panneau de marque navy (logo Make Your Com, devise)
 * + formulaire clair et accessible.
 * La logique d'authentification (LoginForm → loginAction) est inchangée.
 */
export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-ground text-foreground lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Panneau de marque */}
      <section
        aria-label="Make Your Com"
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

        <Logo variant="wordmark" tone="dark" size={48} />

        <div className="mt-7 flex flex-col gap-5 sm:mt-10 lg:my-auto lg:gap-7">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-navy-200">
            <span aria-hidden="true" className="size-2 rounded-full bg-coral-400" />
            CRM ACLR Sàrl · accès réservé à l&apos;équipe
          </span>

          <p className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] sm:text-[44px] lg:text-[52px]">
            Chaque appel compte.{" "}
            <span className="text-coral-400">Chaque RDV est une chance.</span>{" "}
            Chaque signature rapporte.
          </p>

          <p className="max-w-xl text-[15px] leading-relaxed text-navy-200">
            Connecte-toi pour retrouver ta journée, tes RDV, tes contrats et
            tes commissions.
          </p>

          {/* Ce qu'on retrouve dans le CRM */}
          <ul
            aria-label="Ce que tu retrouves dans le CRM"
            className="hidden grid-cols-2 gap-2.5 sm:grid lg:max-w-xl"
          >
            {HIGHLIGHTS.map((r) => (
              <li
                key={r.label}
                className="flex flex-col gap-0.5 rounded-[14px] border border-white/12 bg-white/[0.06] px-3.5 py-3"
              >
                <span className="text-[13px] font-extrabold text-white">{r.label}</span>
                <span className="text-xs font-semibold text-navy-200">{r.detail}</span>
              </li>
            ))}
          </ul>
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
