/**
 * Statuts des factures clients (MYC Arena) : libellés, teintes et pastille.
 *
 * « En retard » visuel = statut EN_RETARD, ou ENVOYEE dont l'échéance est
 * passée (le cron nocturne les bascule ensuite en EN_RETARD).
 * « Brouillon · en retard » = brouillon émis un mois précédent, jamais envoyé.
 */
import { StatusPill, type PillSize } from "@/components/arena/pills";
import type { Tone } from "@/components/arena/tones";

export const CLIENT_INVOICE_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
};

export const CLIENT_INVOICE_TONE: Record<string, Tone> = {
  BROUILLON: "navy",
  ENVOYEE: "blue",
  PAYEE: "green",
  EN_RETARD: "red",
  ANNULEE: "navy",
};

export const CLIENT_INVOICE_TYPE_LABEL: Record<string, string> = {
  MENSUALITE: "Mensualité",
  ACOMPTE: "Acompte",
  SOLDE: "Solde",
  ANNUELLE: "Annuelle",
  PONCTUELLE: "Ponctuelle",
};

export function ClientInvoiceStatusPill({
  statut,
  overdue = false,
  staleDraft = false,
  size = "sm",
}: {
  statut: string;
  /** Envoyée et échue (affichée en retard). */
  overdue?: boolean;
  /** Brouillon d'un mois précédent, toujours pas envoyé. */
  staleDraft?: boolean;
  size?: PillSize;
}) {
  if (overdue) {
    return (
      <StatusPill tone="red" size={size}>
        En retard
      </StatusPill>
    );
  }
  if (staleDraft) {
    return (
      <StatusPill tone="red" size={size}>
        Brouillon · en retard
      </StatusPill>
    );
  }
  return (
    <StatusPill tone={CLIENT_INVOICE_TONE[statut] ?? "navy"} size={size}>
      {CLIENT_INVOICE_LABEL[statut] ?? statut}
    </StatusPill>
  );
}
