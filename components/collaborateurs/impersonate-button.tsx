"use client";

/**
 * Bouton « Voir en tant que » sur la fiche collaborateur (admin only).
 * Lance l'impersonation : le serveur pose le cookie et redirige vers l'accueil,
 * l'admin voit alors le CRM comme ce collaborateur (bandeau pour quitter).
 */
import { Eye, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { impersonateUser } from "@/app/(app)/rh/impersonation-actions";
import { Button } from "@/components/ui/button";

export function ImpersonateButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // En cas de succès, l'action redirige (rien n'est renvoyé).
          const res = await impersonateUser(userId);
          if (res && !res.ok) toast.error(res.error);
        })
      }
      title="Voir le CRM comme ce collaborateur (support)"
    >
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Eye aria-hidden="true" />}
      {pending ? "Bascule…" : `Voir en tant que ${userName.split(" ")[0]}`}
    </Button>
  );
}
