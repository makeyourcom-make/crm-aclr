import type { PaymentStatut } from "@prisma/client";

import { StatusPill } from "@/components/arena/pills";
import type { Tone } from "@/components/arena/tones";

const LABELS: Record<PaymentStatut, string> = {
  EN_ATTENTE: "En attente",
  ENCAISSE: "Encaissé",
  EN_RETARD: "En retard",
};

const TONES: Record<PaymentStatut, Tone> = {
  EN_ATTENTE: "navy",
  ENCAISSE: "green",
  EN_RETARD: "red",
};

export function PaymentStatutBadge({ statut }: { statut: PaymentStatut }) {
  return <StatusPill tone={TONES[statut] ?? "navy"}>{LABELS[statut] ?? statut}</StatusPill>;
}
