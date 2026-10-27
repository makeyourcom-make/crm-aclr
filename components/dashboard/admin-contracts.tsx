/**
 * Blocs admin « À traiter » : contrats à valider définitivement (contre-signés
 * par la commerciale → ACTIF) et contrats signés par le client en attente de
 * la signature commerciale. Les boutons d'action sont ceux des rubriques
 * Contrats / Signatures (mêmes actions serveur, mêmes droits).
 * Server-safe.
 */
import { PenLine, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { ValidateContractButton } from "@/components/contrats/validate-contract-button";
import { SignAclrButton } from "@/components/signatures/sign-aclr-button";
import { formatCHF } from "@/lib/format";
import type { DashboardData } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

import { zDate } from "./dates";

type Definitif = NonNullable<DashboardData["contratsAValiderDefinitif"]>[number];
type ASigner = NonNullable<DashboardData["contratsAValider"]>[number];

const ROW =
  "flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0";

export function ContratsAValiderDefinitif({
  contrats,
  className,
}: {
  contrats: Definitif[];
  className?: string;
}) {
  if (contrats.length === 0) return null;
  return (
    <SectionCard
      title="Contrats à valider définitivement"
      icon={ShieldCheck}
      tone="violet"
      className={cn("border-lvl-500/30", className)}
      description="Contre-signés par la commerciale : ta validation les passe en actif"
      action={<StatusPill tone="violet">{contrats.length} à valider</StatusPill>}
    >
      <ul className="flex flex-col divide-y divide-border">
        {contrats.map((c) => (
          <li key={c.contractId} className={ROW}>
            <div className="min-w-0 flex-[1_1_220px]">
              <Link
                href={`/contrats/${c.contractId}`}
                className="text-sm font-bold text-foreground hover:underline"
              >
                {c.numero} · {c.raisonSociale}
              </Link>
              <p className="text-xs font-medium text-muted-foreground">
                Signé par {c.commercialeName}
                {c.contreSigneLe ? ` le ${zDate(c.contreSigneLe)}` : ""}
              </p>
            </div>
            <p className="font-display text-base font-extrabold text-lvl-700 tabular-nums">
              {formatCHF(c.valeurAn1)}
            </p>
            {/* Carte de victoire complète (client, prénom, XP de signature),
                comme dans la file Contrats. */}
            <ValidateContractButton
              contractId={c.contractId}
              clientName={c.raisonSociale}
              montantMensuel={c.montantMensuel}
              assigneeName={c.commercialeName !== "-" ? c.commercialeName : undefined}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function ContratsASigner({
  contrats,
  className,
}: {
  contrats: ASigner[];
  className?: string;
}) {
  if (contrats.length === 0) return null;
  return (
    <SectionCard
      title="Contrats signés client - signature commerciale à faire"
      icon={PenLine}
      tone="green"
      className={cn("border-win-500/30", className)}
      description="Le client a signé : il ne manque que la signature côté ACLR"
      action={<StatusPill tone="green">{contrats.length} à signer</StatusPill>}
    >
      <ul className="flex flex-col divide-y divide-border">
        {contrats.map((c) => (
          <li key={c.contractId} className={ROW}>
            <div className="min-w-0 flex-[1_1_220px]">
              <Link
                href={`/contrats/${c.contractId}`}
                className="text-sm font-bold text-foreground hover:underline"
              >
                {c.numero} · {c.raisonSociale}
              </Link>
              <p className="text-xs font-medium text-muted-foreground">
                Signé par le client le{" "}
                {c.dateSignatureClient ? zDate(c.dateSignatureClient) : "-"} · Commerciale :{" "}
                {c.commercialeName}
              </p>
            </div>
            <p className="font-display text-base font-extrabold text-win-700 tabular-nums">
              {formatCHF(c.valeurAn1)}
            </p>
            <SignAclrButton signatureId={c.signatureId} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
