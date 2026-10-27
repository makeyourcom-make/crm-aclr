/**
 * File « À traiter » de la rubrique Contrats : validations admin, signatures
 * en cours (lien actif, signé client, lien expiré) et renouvellements à
 * moins de 30 jours, du plus chaud au plus froid. Données réelles uniquement.
 *
 * Server component : les actions (valider, contre-signer) sont des boutons
 * client existants ; le reste mène à la fiche contrat (QR, nouveau lien…).
 */
import { ListChecks, PartyPopper } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatInt } from "@/components/arena/format";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import type { Tone } from "@/components/arena/tones";
import { EmptyState } from "@/components/arena/empty-state";
import { ValidateContractButton } from "@/components/contrats/validate-contract-button";
import { SignAclrButton } from "@/components/signatures/sign-aclr-button";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ContractWorkQueue } from "@/lib/queries/contracts";

interface QueueItem {
  key: string;
  priority: number;
  sortAt: number;
  tag: string;
  tone: Tone;
  title: string;
  href: string;
  sub: string;
  action: ReactNode;
}

const MAX_VISIBLE = 10;

function linkButton(href: string, label: string) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-3.5")}
    >
      {label}
    </Link>
  );
}

function an1(v: number): string {
  return `${formatInt(v)} CHF an 1`;
}

export function ContractsWorkQueue({
  queue,
  isAdmin,
  userId,
  now,
}: {
  queue: ContractWorkQueue;
  isAdmin: boolean;
  userId: string;
  /** Instant de référence (ms), fourni par la page. */
  now: number;
}) {
  const items: QueueItem[] = [];

  for (const c of queue.pending) {
    const sig = c.lastSignature;
    const href = `/contrats/${c.id}`;
    const title = `${c.raisonSociale} · ${c.numero}`;

    if (c.statut === "ATTENTE_VALIDATION_ADMIN") {
      const parts: string[] = [];
      if (sig?.dateSignatureClient) parts.push(`Client signé le ${formatDate(sig.dateSignatureClient)}`);
      if (sig?.signeParAclr) {
        parts.push(sig.nomAclr ? `contre-signé par ${sig.nomAclr}` : "contre-signé");
      }
      if (parts.length === 0) parts.push("Deux signatures reçues");
      parts.push(an1(c.valeurAn1));
      items.push({
        key: c.id,
        priority: 0,
        sortAt: sig?.dateSignatureClient?.getTime() ?? c.createdAt.getTime(),
        tag: "À valider (admin)",
        tone: "violet",
        title,
        href,
        sub: parts.join(" · "),
        action: isAdmin ? (
          <ValidateContractButton
            contractId={c.id}
            clientName={c.raisonSociale}
            montantMensuel={c.montantMensuel}
            assigneeName={c.assigneName}
            size="sm"
            className="h-9"
          />
        ) : (
          linkButton(href, "Voir")
        ),
      });
      continue;
    }

    // ATTENTE_SIGNATURE_CLIENT
    const canCountersign = isAdmin || c.assigneAId === userId;
    if (!sig) {
      items.push({
        key: c.id,
        priority: 4,
        sortAt: c.createdAt.getTime(),
        tag: "À envoyer",
        tone: "navy",
        title,
        href,
        sub: `Créé le ${formatDate(c.createdAt)} · pas encore de lien de signature · ${an1(c.valeurAn1)}`,
        action: linkButton(href, "Préparer la signature"),
      });
      continue;
    }
    if (sig.signeParClient && !sig.signeParAclr) {
      items.push({
        key: c.id,
        priority: 1,
        sortAt: sig.dateSignatureClient?.getTime() ?? sig.createdAt.getTime(),
        tag: "Signé client",
        tone: "violet",
        title,
        href,
        sub: `Client signé le ${formatDate(sig.dateSignatureClient)} · reste la contre-signature · ${an1(c.valeurAn1)}`,
        action: canCountersign ? (
          <SignAclrButton signatureId={sig.id} className="h-9" />
        ) : (
          linkButton(href, "Voir")
        ),
      });
      continue;
    }
    const expired = sig.expireA.getTime() <= now;
    if (sig.statut !== "COMPLETEE" && !expired) {
      const daysLeft = Math.max(0, Math.ceil((sig.expireA.getTime() - now) / 86_400_000));
      items.push({
        key: c.id,
        priority: 2,
        sortAt: sig.expireA.getTime(),
        tag: daysLeft <= 3 ? `Expire dans ${daysLeft} j` : "En attente signature",
        tone: daysLeft <= 3 ? "gold" : "blue",
        title,
        href,
        sub: `Lien créé le ${formatDate(sig.createdAt)} · expire le ${formatDate(sig.expireA)} · ${an1(c.valeurAn1)}`,
        action: linkButton(href, "Suivre en direct"),
      });
      continue;
    }
    if (expired && sig.statut !== "COMPLETEE") {
      items.push({
        key: c.id,
        priority: 3,
        sortAt: sig.expireA.getTime(),
        tag: "Lien expiré",
        tone: "red",
        title,
        href,
        sub: `Expiré le ${formatDate(sig.expireA)} · ${an1(c.valeurAn1)} en jeu`,
        action: linkButton(href, "Nouveau lien"),
      });
      continue;
    }
    items.push({
      key: c.id,
      priority: 4,
      sortAt: c.createdAt.getTime(),
      tag: "À vérifier",
      tone: "navy",
      title,
      href,
      sub: `Signature complète mais contrat toujours en attente · ${an1(c.valeurAn1)}`,
      action: linkButton(href, "Ouvrir"),
    });
  }

  for (const r of queue.renewals) {
    items.push({
      key: `renew-${r.id}`,
      priority: 5,
      sortAt: r.renewal.getTime(),
      tag: r.days <= 0 ? "Renouvel. aujourd'hui" : `Renouvel. J-${r.days}`,
      tone: "gold",
      title: `${r.raisonSociale} · ${r.numero}`,
      href: `/contrats/${r.id}`,
      sub: `${formatDate(r.renewal)} · ${an1(r.valeurAn1)} à sécuriser`,
      action: linkButton(`/contrats/${r.id}`, "Ouvrir le contrat"),
    });
  }

  items.sort((a, b) => a.priority - b.priority || a.sortAt - b.sortAt);
  const visible = items.slice(0, MAX_VISIBLE);
  const hidden = items.length - visible.length;

  return (
    <SectionCard
      title={`À traiter · ${formatInt(items.length)}`}
      icon={ListChecks}
      tone="navy"
      description="Signatures, validations et renouvellements, du plus chaud au plus froid"
      className="flex-[2_1_520px]"
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          tone="green"
          title="Rien qui traîne !"
          description="Aucune signature en attente ni renouvellement dans les 30 jours. Va chercher le prochain contrat."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visible.map((it) => (
            <li
              key={it.key}
              className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-ground px-3.5 py-3"
            >
              <StatusPill tone={it.tone} className="whitespace-nowrap">
                {it.tag}
              </StatusPill>
              <div className="min-w-0 flex-[1_1_220px]">
                <Link
                  href={it.href}
                  className="text-sm font-extrabold break-words text-foreground hover:underline"
                >
                  {it.title}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">{it.sub}</p>
              </div>
              <div className="shrink-0">{it.action}</div>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          +{formatInt(hidden)} autre{hidden > 1 ? "s" : ""} :{" "}
          <Link
            href="/contrats?statut=ATTENTE_SIGNATURE_CLIENT"
            className="font-bold text-info-700 underline underline-offset-2"
          >
            voir les contrats en attente de signature
          </Link>
        </p>
      )}
    </SectionCard>
  );
}
