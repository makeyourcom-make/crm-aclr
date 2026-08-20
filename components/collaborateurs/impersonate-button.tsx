"use client";

/**
 * Bouton « Voir en tant que » sur la fiche collaborateur (admin only).
 * Lance l'impersonation : le serveur pose le cookie et redirige vers l'accueil,
 * l'admin voit alors le CRM comme ce collaborateur (bandeau pour quitter).
 */
import { useTransition } from "react";
import { toast } from "sonner";

import { impersonateUser } from "@/app/(app)/rh/impersonation-actions";
import { Icon } from "@/components/icon";

export function ImpersonateButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // En cas de succès, l'action redirige (rien n'est renvoyé).
          const res = await impersonateUser(userId);
          if (res && !res.ok) toast.error(res.error);
        })
      }
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
      title="Voir le CRM comme ce collaborateur (support)"
    >
      <Icon name="Eye" className="h-4 w-4" />
      {pending ? "Bascule…" : `Voir en tant que ${userName.split(" ")[0]}`}
    </button>
  );
}
