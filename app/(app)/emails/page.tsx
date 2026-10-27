import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { ProspectStatut } from "@prisma/client";

import type { Tone } from "@/components/arena/tones";
import { ComposeEmailButton } from "@/components/emails/compose-email-button";
import { EmailsHero } from "@/components/emails/emails-hero";
import {
  EmailsPerformance,
  type SpamOverview,
} from "@/components/emails/emails-performance";
import { InboxView } from "@/components/emails/inbox-view";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getProspectStatutLabel } from "@/lib/labels";
import { requireUser } from "@/lib/session";

import { getMailArenaStats, type MailArenaStats } from "./arena-stats";

export const metadata = { title: "Emails" };
export const dynamic = "force-dynamic";

/** Teinte MYC Arena de chaque statut d'entreprise (pastilles de la boîte). */
const STATUT_TONE: Record<ProspectStatut, Tone> = {
  NOUVEAU: "blue",
  VIERGE: "navy",
  CONTACTE: "blue",
  QUALIFIE: "teal",
  RDV_PRIS: "gold",
  PROPOSITION_ENVOYEE: "violet",
  SIGNE: "green",
  PERDU: "navy",
  NUMERO_INVALIDE: "red",
  NE_PAS_RAPPELER: "red",
};

/** Instant du rendu (requête dynamique) : sert aux durées relatives de la boîte. */
function requestNow(): number {
  return Date.now();
}

export default async function EmailsPage() {
  const user = await requireUser();
  // Boîte privée par utilisateur : même l'admin ne voit pas les mails de l'équipe.
  // Si supervision croisée nécessaire un jour, ajouter un toggle explicite.
  const emailInclude = {
    prospect: {
      select: { id: true, raisonSociale: true, ville: true, statut: true },
    },
    collaborateur: { select: { id: true, name: true } },
    user: { select: { name: true } },
    attachments: {
      select: {
        id: true,
        nom: true,
        taille: true,
        mimeType: true,
        url: true,
      },
    },
  } as const;

  // Boîte active (hors archivés, hors corbeille) + Corbeille + Archivés + chiffres
  // du jeu + filtres anti-spam, en parallèle.
  const [emails, trashedEmails, archivedEmails, stats, spamRules, spamAgg] =
    await Promise.all([
      prisma.email.findMany({
        where: { userId: user.id, archive: false, supprime: false },
        include: emailInclude,
        orderBy: { createdAt: "desc" },
        // 80 = compromis : couvre la vue active (les threads inactifs > 80 derniers
        // sont rarement consultés depuis l'inbox). Avec index userId+createdAt DESC,
        // requête sub-ms. Pour rechercher plus loin, la fiche prospect montre tout.
        take: 80,
      }),
      prisma.email.findMany({
        where: { userId: user.id, supprime: true },
        include: emailInclude,
        orderBy: { supprimeeLe: "desc" },
        take: 80,
      }),
      prisma.email.findMany({
        where: { userId: user.id, archive: true, supprime: false },
        include: emailInclude,
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      // Si les chiffres du jeu échouent, la boîte reste pleinement utilisable.
      getMailArenaStats(user.id).catch((err): MailArenaStats | null => {
        console.error("[emails] chiffres du jeu indisponibles :", err);
        return null;
      }),
      prisma.emailBlockRule.findMany({
        orderBy: [{ actif: "desc" }, { nbBloques: "desc" }, { createdAt: "desc" }],
        select: { id: true, type: true, value: true, actif: true, nbBloques: true },
        take: 4,
      }),
      prisma.emailBlockRule.groupBy({
        by: ["actif"],
        _count: { _all: true },
        _sum: { nbBloques: true },
      }),
    ]);

  const isDryRun = process.env.EMAIL_MODE !== "live";
  const nowMs = requestNow();

  // Sérialise pour le composant client (Date → string)
  const serialize = (e: (typeof emails)[number]) => ({
    id: e.id,
    direction: e.direction as "SORTANT" | "ENTRANT",
    threadId: e.threadId,
    expediteurEmail: e.expediteurEmail,
    expediteurNom: e.expediteurNom,
    destinataireEmail: e.destinataireEmail,
    cc: e.cc,
    bcc: e.bcc,
    objet: e.objet,
    contenuHtml: e.contenuHtml,
    contenuTexte: e.contenuTexte,
    statut: e.statut,
    envoyeLe: e.envoyeLe ? e.envoyeLe.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
    lu: e.lu,
    labels: e.labels,
    resendInboundId: e.resendInboundId,
    prospect: e.prospect
      ? {
          id: e.prospect.id,
          raisonSociale: e.prospect.raisonSociale,
          ville: e.prospect.ville,
          statutLabel:
            e.prospect.statut === "VIERGE" ? null : getProspectStatutLabel(e.prospect.statut),
          statutTone: STATUT_TONE[e.prospect.statut] ?? "blue",
        }
      : null,
    collaborateur: e.collaborateur,
    user: e.user,
    attachments: e.attachments,
  });
  const serialized = emails.map(serialize);
  const serializedTrash = trashedEmails.map(serialize);
  const serializedArchive = archivedEmails.map(serialize);

  // Leads à capter : fils reçus dont aucun mail n'est rattaché à une entreprise.
  const byThread = new Map<string, { inbound: boolean; linked: boolean }>();
  for (const e of emails) {
    const cur = byThread.get(e.threadId) ?? { inbound: false, linked: false };
    if (e.direction === "ENTRANT") cur.inbound = true;
    if (e.prospectId) cur.linked = true;
    byThread.set(e.threadId, cur);
  }
  const leadsToCapture = [...byThread.values()].filter((t) => t.inbound && !t.linked).length;

  const spam: SpamOverview = {
    active: spamAgg.find((g) => g.actif)?._count._all ?? 0,
    total: spamAgg.reduce((s, g) => s + g._count._all, 0),
    blocked: spamAgg.reduce((s, g) => s + (g._sum.nbBloques ?? 0), 0),
    top: spamRules,
  };

  const unread =
    stats?.unreadInbox ??
    emails.filter((e) => e.direction === "ENTRANT" && !e.lu).length;
  const sentLine = stats
    ? ` · ${stats.sentToday} mail${stats.sentToday > 1 ? "s" : ""} envoyé${stats.sentToday > 1 ? "s" : ""} aujourd'hui`
    : "";

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="emails"
        title="Emails"
        description={`Ta boîte privée · ${unread} non lu${unread > 1 ? "s" : ""} à traiter${sentLine}`}
        actions={
          stats ? undefined : (
            <>
              <Link href="/emails/filtres" className={buttonVariants({ variant: "outline" })}>
                <ShieldCheck aria-hidden="true" />
                Filtres anti-spam
              </Link>
              <ComposeEmailButton />
            </>
          )
        }
      />

      {isDryRun && (
        <div className="mb-5 rounded-[14px] border border-gold-500/40 bg-gold-50 px-4 py-3 text-sm text-gold-700">
          <strong className="font-extrabold">Mode dry-run</strong> : les emails sont
          enregistrés en base mais pas réellement envoyés. Active{" "}
          <code className="font-mono">EMAIL_MODE=live</code> +{" "}
          <code className="font-mono">RESEND_API_KEY</code> dans Vercel pour passer en
          vrai envoi.
        </div>
      )}

      <div className="flex flex-col gap-6">
        {stats && <EmailsHero stats={stats} leadsToCapture={leadsToCapture} />}

        <InboxView
          emails={serialized}
          trashedEmails={serializedTrash}
          archivedEmails={serializedArchive}
          isAdmin={user.role === "ADMIN"}
          currentUserEmail={user.email}
          nowMs={nowMs}
          unreadInbox={stats?.unreadInbox}
          treatedToday={stats?.treatedToday}
          spamSummary={{ active: spam.active, blocked: spam.blocked }}
        />

        {stats && <EmailsPerformance stats={stats} spam={spam} />}
      </div>
    </div>
  );
}
