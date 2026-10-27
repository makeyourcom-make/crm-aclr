/**
 * « Relances » : propositions envoyées (contrats en attente de signature du
 * client), les plus anciennes en premier. Lien vers le contrat (relance de
 * signature, QR, PDF) et Appeler via le click-to-call.
 *
 * Server-safe. Données réelles : contrats ATTENTE_SIGNATURE_CLIENT de la
 * commerciale (même périmètre que /contrats pour un commercial).
 */
import { ArrowRight, FileSignature } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/arena/empty-state";
import { formatInt, plural } from "@/components/arena/format";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import type { Tone } from "@/components/arena/tones";
import { formatCHFCompact, formatMoney } from "@/lib/format";
import type { RelanceItem } from "@/lib/queries/today";

import { CallButton } from "./call-button";

function montant(n: number, devise: string): string {
  return devise.toUpperCase() === "CHF" ? formatCHFCompact(n) : formatMoney(n, devise);
}

function montants(r: RelanceItem): string | null {
  const parts: string[] = [];
  if (r.montantOneShot > 0) parts.push(montant(r.montantOneShot, r.devise));
  if (r.montantMensuel > 0) parts.push(`${montant(r.montantMensuel, r.devise)} / mois`);
  return parts.length > 0 ? parts.join(" + ") : null;
}

function joursTone(j: number): Tone {
  if (j >= 7) return "red";
  if (j >= 5) return "gold";
  return "blue";
}

export function RelancesCard({ items, total }: { items: RelanceItem[]; total: number }) {
  return (
    <SectionCard
      title="Relances"
      icon={FileSignature}
      tone="violet"
      description="Propositions envoyées, toujours sans signature"
      action={
        total > 0 ? (
          <StatusPill tone="violet" dot={false}>
            {formatInt(total)} à relancer
          </StatusPill>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          tone="violet"
          title="Aucune proposition en attente"
          description="Chaque proposition envoyée compte pour ton objectif du jour. Après un RDV, envoie-la tant que c'est chaud."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          <ul className="flex flex-col gap-2.5">
            {items.map((r) => {
              const m = montants(r);
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-card p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-[1_1_180px]">
                      <div className="text-[15px] font-bold break-words">
                        <Link
                          href={`/contrats/${r.id}`}
                          className="text-foreground hover:underline"
                        >
                          {r.raisonSociale}
                        </Link>
                        {r.ville && (
                          <span className="text-[13px] font-medium text-muted-foreground">
                            {" "}
                            · {r.ville}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[13px] break-words text-muted-foreground">
                        {[r.offre, m].filter(Boolean).join(" · ") || r.numero}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Envoyée le {r.envoyeeLe} · {r.numero}
                      </div>
                    </div>
                    <StatusPill tone={joursTone(r.jours)} dot={false} className="whitespace-nowrap">
                      {r.jours === 0
                        ? "Envoyée aujourd'hui"
                        : `${plural(r.jours, "jour")} sans signature`}
                    </StatusPill>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/contrats/${r.id}`}
                      className="inline-flex h-10 flex-[1_1_150px] items-center justify-center gap-2 rounded-[12px] bg-navy-700 px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-navy-600"
                    >
                      Relancer depuis le contrat
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                    {r.telephone && (
                      <CallButton
                        prospectId={r.prospectId}
                        raisonSociale={r.raisonSociale}
                        telephone={r.telephone}
                        variant="outline"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {total > items.length && (
            <Link
              href="/contrats?statut=ATTENTE_SIGNATURE_CLIENT"
              className="self-start text-[13px] font-bold text-info-700 hover:underline"
            >
              Voir les {formatInt(total)} contrats en attente de signature
            </Link>
          )}
        </div>
      )}
    </SectionCard>
  );
}
