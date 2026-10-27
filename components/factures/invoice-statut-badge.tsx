import { InvoiceStatut } from "@prisma/client";

import { StatusPill } from "@/components/arena/pills";
import type { Tone } from "@/components/arena/tones";

const LABELS: Record<InvoiceStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
};

const TONES: Record<InvoiceStatut, Tone> = {
  BROUILLON: "navy",
  ENVOYEE: "blue",
  PAYEE: "green",
};

/** Pastille de statut d'une fiche de salaire (MYC Arena). */
export function InvoiceStatutBadge({ statut }: { statut: InvoiceStatut }) {
  return <StatusPill tone={TONES[statut]}>{LABELS[statut]}</StatusPill>;
}
