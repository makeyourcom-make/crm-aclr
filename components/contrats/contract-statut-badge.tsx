/**
 * Pastille de statut d'un contrat (MYC Arena : fond clair + texte foncé de la
 * teinte, point de couleur). Même API qu'avant (`statut`), utilisée aussi par
 * la fiche entreprise.
 */
import type { ContractStatut } from "@prisma/client";

import { StatusPill, type PillSize } from "@/components/arena/pills";
import type { Tone } from "@/components/arena/tones";

export const CONTRACT_STATUT_LABEL: Record<ContractStatut, string> = {
  ATTENTE_SIGNATURE_CLIENT: "En attente signature",
  ATTENTE_VALIDATION_ADMIN: "À valider (admin)",
  ACTIF: "Actif",
  SUSPENDU: "Suspendu",
  RESILIE: "Résilié",
  EXPIRE: "Expiré",
};

export const CONTRACT_STATUT_TONE: Record<ContractStatut, Tone> = {
  ATTENTE_SIGNATURE_CLIENT: "blue",
  ATTENTE_VALIDATION_ADMIN: "violet",
  ACTIF: "green",
  SUSPENDU: "gold",
  RESILIE: "red",
  EXPIRE: "navy",
};

export function ContractStatutBadge({
  statut,
  size = "sm",
  className,
}: {
  statut: ContractStatut;
  size?: PillSize;
  className?: string;
}) {
  return (
    <StatusPill
      tone={CONTRACT_STATUT_TONE[statut] ?? "navy"}
      size={size}
      className={className}
    >
      {CONTRACT_STATUT_LABEL[statut] ?? statut}
    </StatusPill>
  );
}
