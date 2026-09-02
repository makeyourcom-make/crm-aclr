"use client";

/**
 * Bouton admin « Réinitialiser le mot de passe » sur la fiche collaborateur.
 * Génère un mot de passe temporaire, l'envoie à l'email de récupération externe
 * du collaborateur (si défini) et l'affiche à l'admin pour transmission.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resetUserPassword } from "@/app/(app)/rh/security-actions";
import { Icon } from "@/components/icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ResetPasswordButton({
  userId,
  userName,
  hasRecoveryEmail,
}: {
  userId: string;
  userName: string;
  hasRecoveryEmail: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ tempPassword: string; emailedTo: string | null } | null>(null);

  const handle = () => {
    if (!confirm(`Réinitialiser le mot de passe de ${userName} ? Son mot de passe actuel sera invalidé.`)) return;
    startTransition(async () => {
      const res = await resetUserPassword(userId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la réinitialisation.");
        return;
      }
      setResult({ tempPassword: res.tempPassword, emailedTo: res.emailedTo });
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        title="Générer un mot de passe temporaire pour ce collaborateur"
      >
        <Icon name={pending ? "Loader" : "Lock"} className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
      </button>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mot de passe réinitialisé</DialogTitle>
            <DialogDescription>
              Mot de passe temporaire de {userName}. À transmettre — il ne sera
              plus affiché ensuite.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                <code className="select-all text-base font-semibold">
                  {result.tempPassword}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(result.tempPassword);
                    toast.success("Copié ✓");
                  }}
                  className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-xs hover:bg-muted"
                >
                  <Icon name="Copy" className="h-3.5 w-3.5" />
                  Copier
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {result.emailedTo
                  ? `Également envoyé par email à ${result.emailedTo}.`
                  : hasRecoveryEmail
                    ? "L'envoi par email a échoué — transmets-le manuellement."
                    : "Aucun email de récupération défini pour ce collaborateur — transmets-le manuellement (et renseigne un email de secours dans sa fiche)."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Le collaborateur devra le changer dans Paramètres → Sécurité.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
