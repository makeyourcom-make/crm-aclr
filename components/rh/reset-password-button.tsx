"use client";

/**
 * Bouton admin « Réinitialiser le mot de passe » sur la fiche collaborateur.
 * Génère un mot de passe temporaire, l'envoie à l'email de récupération externe
 * du collaborateur (si défini) et l'affiche à l'admin pour transmission.
 */
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resetUserPassword } from "@/app/(app)/rh/security-actions";
import { Button } from "@/components/ui/button";
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
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handle}
        disabled={pending}
        title="Générer un mot de passe temporaire pour ce collaborateur"
        className="border-gold-500/50 bg-gold-50 text-gold-700 hover:bg-gold-50/70 hover:text-gold-700"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <KeyRound aria-hidden="true" />
        )}
        {pending ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
      </Button>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mot de passe réinitialisé</DialogTitle>
            <DialogDescription>
              Mot de passe temporaire de {userName}. À transmettre : il ne sera
              plus affiché ensuite.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-ground px-3 py-2.5">
                <code className="text-base font-bold break-all select-all">
                  {result.tempPassword}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(result.tempPassword);
                    toast.success("Copié.");
                  }}
                >
                  <Copy aria-hidden="true" />
                  Copier
                </Button>
              </div>
              <p className="text-[13px] text-muted-foreground">
                {result.emailedTo
                  ? `Également envoyé par email à ${result.emailedTo}.`
                  : hasRecoveryEmail
                    ? "L'envoi par email a échoué : transmets-le manuellement."
                    : "Aucun email de récupération défini pour ce collaborateur : transmets-le manuellement (et renseigne un email de secours dans sa fiche)."}
              </p>
              <p className="text-xs text-muted-foreground">
                Le collaborateur devra le changer dans Paramètres → Sécurité.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
