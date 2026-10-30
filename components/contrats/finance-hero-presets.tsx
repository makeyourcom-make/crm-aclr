/**
 * Préréglages du héros finance : textes coach + CTA + tuiles, selon le rôle.
 *   - admin  : « Caisse du jour » (brouillons, retards, validations, encaissé)
 *   - commerciale : « Ton portefeuille » (signatures du mois, en attente)
 * Utilisé par /contrats, /factures-clients et /signatures pour un héros
 * identique d'une page à l'autre. Server-safe.
 */
import { Plus, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatInt } from "@/components/arena/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { FinancePulse } from "@/lib/queries/contracts";

import { FinanceHero, type HeroTile } from "./finance-hero";

/** Bouton secondaire lisible sur le navy du héros. */
export const HERO_GHOST_LINK =
  "inline-flex h-12 shrink-0 items-center gap-2 rounded-[12px] border border-white/30 bg-white/[0.06] px-4 text-sm font-bold whitespace-nowrap text-white transition-colors hover:bg-white/[0.12]";

function pl(n: number, one: string, many: string): string {
  return `${formatInt(n)} ${n > 1 ? many : one}`;
}

/**
 * Ligne argent du mois (chiffres réels du pulse) : CA signé, MRR ajouté et,
 * si un objectif de CA existe, ce qu'il manque pour l'atteindre.
 */
function moneyCopy(p: FinancePulse): string {
  const parts = [`CA signé ce mois : ${formatInt(p.signedValue)} CHF`];
  if (p.signedMensuel > 0) parts.push(`+${formatInt(p.signedMensuel)} CHF / mois de MRR`);
  let line = `${parts.join(" · ")}.`;
  if (p.caTarget != null && p.caTarget > 0) {
    const reste = Math.max(0, p.caTarget - p.signedValue);
    line +=
      reste > 0
        ? ` Il te manque ${formatInt(reste)} CHF pour l'objectif du mois.`
        : " Objectif du mois atteint.";
  }
  return line;
}

export function adminHeroCopy(p: FinancePulse): { title: string; subtitle: string } {
  const d = p.invoices?.draftsCount ?? 0;
  const r = p.invoices?.overdueCount ?? 0;
  let title: string;
  if (d > 0 && r > 0) {
    title = `${pl(d, "facture", "factures")} à lancer, ${pl(r, "retard", "retards")} à chasser.`;
  } else if (d > 0) {
    title = `Zéro retard. Plus que ${pl(d, "facture", "factures")} à lancer.`;
  } else if (r > 0) {
    title = `Brouillons partis. Reste ${pl(r, "retard", "retards")} à chasser.`;
  } else {
    title = "Caisse propre. Tout est parti, rien ne traîne.";
  }
  const n = p.aValider;
  const subtitle =
    n > 0
      ? `Envoie les brouillons, encaisse les retards et valide ${
          n === 1
            ? "le contrat qui attend ton feu vert"
            : `les ${formatInt(n)} contrats qui attendent ton feu vert`
        }.`
      : "Tous les contrats sont validés. Garde le rythme : chaque facture envoyée, c'est du cash qui rentre.";
  return { title, subtitle };
}

export function commercialHeroCopy(p: FinancePulse): { title: string; subtitle: string } {
  const pending = p.enAttenteSignature;
  let title: string;
  if (pending > 0) {
    title = `${pl(pending, "signature", "signatures")} à aller chercher.`;
  } else if (p.signedCount > 0) {
    title = `${pl(p.signedCount, "contrat signé", "contrats signés")} ce mois.`;
  } else {
    title = "Le prochain contrat t'attend.";
  }
  const subtitle =
    p.aValider > 0
      ? `${pl(p.aValider, "contrat attend", "contrats attendent")} la validation admin. ${moneyCopy(p)}`
      : moneyCopy(p);
  return { title, subtitle };
}

function signedTile(p: FinancePulse): HeroTile {
  const t = p.signedTarget;
  const reste = t != null ? Math.max(0, t - p.signedCount) : null;
  return {
    label: "Contrats signés ce mois",
    value: formatInt(p.signedCount),
    unit: t != null ? `/ ${formatInt(t)} objectif` : undefined,
    meter: t != null && t > 0 ? { value: p.signedCount, max: t, label: "Contrats signés ce mois" } : undefined,
    hint:
      reste === null
        ? `${formatInt(p.signedValue)} CHF an 1 signés · pas d'objectif fixé`
        : reste === 0
          ? "Objectif atteint"
          : `Encore ${formatInt(reste)} pour l'objectif${p.aValider > 0 ? ` · ${formatInt(p.aValider)} à valider maintenant` : ""}`,
  };
}

/** Tuiles 100 % factures (brouillons, retards, encaissé du mois). */
export function invoiceTiles(p: FinancePulse): HeroTile[] {
  const inv = p.invoices;
  if (!inv) return [];
  return [
    {
      label: "Factures à envoyer aujourd'hui",
      value: formatInt(inv.draftsCount),
      unit: inv.draftsCount > 1 ? "brouillons" : "brouillon",
      tone: "gold",
      hint:
        inv.draftsCount > 0
          ? `${formatInt(inv.draftsTotal)} CHF prêts à partir · émis à ce jour`
          : `Tout est parti${inv.sentToday > 0 ? ` · ${formatInt(inv.sentToday)} envoyée(s) aujourd'hui` : ""}`,
      href: "/factures-clients#brouillons",
    },
    {
      label: "Factures en retard",
      value: formatInt(inv.overdueCount),
      unit: `${formatInt(inv.overdueTotal)} CHF`,
      tone: inv.overdueCount > 0 ? "coral" : "green",
      hint:
        inv.overdueCount > 0
          ? `Le plus ancien : ${pl(inv.overdueOldestDays, "jour", "jours")} · relance en 1 clic`
          : "Zéro retard, la caisse est propre",
      href: "/factures-clients?statut=EN_RETARD",
    },
    {
      label: `Encaissé · ${p.monthLabel}`,
      value: formatInt(inv.paidMonthTotal),
      unit: "CHF",
      tone: "green",
      hint: `${pl(inv.paidMonthCount, "facture payée", "factures payées")} ce mois`,
      href: "/factures-clients?statut=PAYEE",
    },
  ];
}

export function adminHeroTiles(p: FinancePulse): HeroTile[] {
  return [signedTile(p), ...invoiceTiles(p)];
}

/**
 * Panneau de droite de la page Factures : total encaissé depuis le début de
 * l'année + moyenne mensuelle encaissée (remplace l'anneau MRR, qui est une
 * métrique de contrats).
 */
export function FacturesCashPanel({
  encaisseYtd,
  moyenneMensuelle,
  year,
}: {
  encaisseYtd: number;
  moyenneMensuelle: number;
  year: number;
}) {
  return (
    <div className="flex min-w-0 flex-[0_1_auto] flex-col justify-center gap-2 rounded-[20px] border border-white/12 bg-white/[0.06] px-6 py-5 sm:min-w-[280px]">
      <p className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
        Factures encaissées depuis janvier {year}
      </p>
      <p className="score-number text-[40px] leading-none text-win-50">
        {formatInt(encaisseYtd)}
        <span className="ml-1.5 text-lg font-semibold text-navy-200">CHF</span>
      </p>
      <p className="text-sm font-semibold text-white">
        Moyenne{" "}
        <strong className="font-extrabold text-gold-50">
          {formatInt(moyenneMensuelle)} CHF
        </strong>{" "}
        de factures encaissées / mois
      </p>
    </div>
  );
}

export function commercialHeroTiles(p: FinancePulse): HeroTile[] {
  return [
    signedTile(p),
    {
      label: `CA signé · ${p.monthLabel}`,
      value: formatInt(p.signedValue),
      unit: p.caTarget != null ? `/ ${formatInt(p.caTarget)} CHF` : "CHF",
      tone: "green",
      meter:
        p.caTarget != null && p.caTarget > 0
          ? { value: p.signedValue, max: p.caTarget, label: "CA signé du mois" }
          : undefined,
      hint: "Valeur an 1 des contrats signés",
    },
    {
      label: "Signatures en attente",
      value: formatInt(p.enAttenteSignature),
      unit: "client",
      tone: "gold",
      hint: "Relance, lien ou QR en RDV",
      href: "/signatures",
    },
    {
      label: "En validation admin",
      value: formatInt(p.aValider),
      unit: p.aValider > 1 ? "contrats" : "contrat",
      hint: "Deux signatures reçues, feu vert de l'admin attendu",
      href: "/contrats?statut=ATTENTE_VALIDATION_ADMIN",
    },
  ];
}

/** CTA standards du héros admin (liens). */
export function AdminHeroActions({
  pulse,
  primary,
}: {
  pulse: FinancePulse;
  /** Remplace le CTA principal (ex. bouton d'envoi groupé sur /factures-clients). */
  primary?: ReactNode;
}) {
  const d = pulse.invoices?.draftsCount ?? 0;
  const r = pulse.invoices?.overdueCount ?? 0;
  return (
    <>
      {primary ?? (
        <Link
          href={d > 0 ? "/factures-clients#brouillons" : "/factures-clients"}
          className={buttonVariants({ variant: "hero", size: "xl" })}
        >
          <Send aria-hidden="true" />
          {d > 1
            ? `Envoyer les ${formatInt(d)} brouillons`
            : d === 1
              ? "Envoyer le dernier brouillon"
              : "Voir les factures"}
        </Link>
      )}
      <Link href="/factures-clients?statut=EN_RETARD" className={HERO_GHOST_LINK}>
        <TriangleAlert aria-hidden="true" className="size-[18px]" />
        Chasser les retards ({formatInt(r)})
      </Link>
      <Link href="/contrats?statut=ATTENTE_VALIDATION_ADMIN" className={HERO_GHOST_LINK}>
        <ShieldCheck aria-hidden="true" className="size-[18px]" />
        Contrats à valider ({formatInt(pulse.aValider)})
      </Link>
    </>
  );
}

export function CommercialHeroActions({ pulse }: { pulse: FinancePulse }) {
  return (
    <>
      <Link
        href="/contrats/nouveau"
        className={buttonVariants({ variant: "hero", size: "xl" })}
      >
        <Plus aria-hidden="true" />
        Nouveau contrat
      </Link>
      <Link href="/signatures" className={HERO_GHOST_LINK}>
        Mes signatures ({formatInt(pulse.enAttenteSignature + pulse.aValider)})
      </Link>
    </>
  );
}

/** Héros complet selon le rôle. */
export function RoleFinanceHero({
  pulse,
  primary,
  rightPanel,
  tiles,
}: {
  pulse: FinancePulse;
  primary?: ReactNode;
  /** Remplace l'anneau MRR (ex. panneau « encaissé » sur /factures-clients). */
  rightPanel?: ReactNode;
  /** Remplace les tuiles par défaut (ex. tuiles 100 % factures). */
  tiles?: HeroTile[];
}) {
  if (pulse.isAdmin) {
    const copy = adminHeroCopy(pulse);
    return (
      <FinanceHero
        ariaLabel="Situation financière du jour"
        eyebrow={`Caisse du jour · ${pulse.dayLabel}`}
        title={copy.title}
        subtitle={copy.subtitle}
        actions={<AdminHeroActions pulse={pulse} primary={primary} />}
        mrr={pulse.mrr}
        mrrAdded={pulse.signedMensuel}
        monthLabel={pulse.monthLabel}
        rightPanel={rightPanel}
        tiles={tiles ?? adminHeroTiles(pulse)}
      />
    );
  }
  const copy = commercialHeroCopy(pulse);
  return (
    <FinanceHero
      ariaLabel="Ton portefeuille de contrats"
      eyebrow={`Ton portefeuille · ${pulse.dayLabel}`}
      title={copy.title}
      subtitle={copy.subtitle}
      actions={<CommercialHeroActions pulse={pulse} />}
      mrr={pulse.mrr}
      mrrAdded={pulse.signedMensuel}
      monthLabel={pulse.monthLabel}
      tiles={commercialHeroTiles(pulse)}
    />
  );
}

/** Petit utilitaire : classes d'un lien-bouton secondaire sur fond clair. */
export function outlineLinkClass(className?: string): string {
  return cn(buttonVariants({ variant: "outline", size: "lg" }), className);
}
