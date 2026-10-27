/**
 * Statuts de signature : libellés, teintes, pastille, mode.
 * Un lien non complété dont la date est passée s'affiche « Expirée ».
 * Server-safe.
 */
import { StatusPill, type PillSize } from "@/components/arena/pills";
import type { Tone } from "@/components/arena/tones";

export const SIGNATURE_STATUT_META: Record<string, { label: string; tone: Tone }> = {
  BROUILLON: { label: "Brouillon", tone: "navy" },
  ENVOYEE: { label: "Lien envoyé", tone: "blue" },
  SIGNEE_CLIENT: { label: "Signée client", tone: "violet" },
  SIGNEE_ACLR: { label: "Signée ACLR", tone: "violet" },
  COMPLETEE: { label: "Complète", tone: "green" },
  REFUSEE: { label: "Refusée", tone: "red" },
  EXPIREE: { label: "Expirée", tone: "red" },
};

export function effectiveSignatureStatut(
  statut: string,
  expireA: Date,
  now: Date,
): string {
  if (statut !== "COMPLETEE" && statut !== "REFUSEE" && expireA <= now) return "EXPIREE";
  return statut;
}

export function SignatureStatusPill({
  statut,
  size = "sm",
}: {
  statut: string;
  size?: PillSize;
}) {
  const meta = SIGNATURE_STATUT_META[statut] ?? {
    label: statut.replace(/_/g, " "),
    tone: "navy" as Tone,
  };
  return (
    <StatusPill tone={meta.tone} size={size}>
      {meta.label}
    </StatusPill>
  );
}

/** Mode de signature déduit des traces (tracé au doigt, PDF papier joint…). */
export function signatureMode(s: {
  drawnByClient: boolean;
  documentSigneUrl: string | null;
  signeParClient: boolean;
}): string {
  if (s.drawnByClient) return "Au doigt (QR ou lien)";
  if (s.documentSigneUrl) return "Contrat papier (PDF)";
  if (s.signeParClient) return "Signé";
  return "Lien de signature";
}
