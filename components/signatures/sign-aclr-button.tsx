"use client";

/**
 * Contre-signature vendeur (admin ou commerciale assignée) depuis le CRM.
 * Succès : toast, rafraîchissement de la page (statut contrat, coquille XP)
 * puis `onSuccess` éventuel (confettis du pipeline…).
 */
import { LoaderCircle, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { signByAclr } from "@/app/(app)/signatures/actions";
import { Button } from "@/components/ui/button";

export function SignAclrButton({
  signatureId,
  onSuccess,
  size = "sm",
  className,
}: {
  signatureId: string;
  /** Appelé après contre-signature réussie (ex. confettis + refresh). */
  onSuccess?: () => void;
  size?: "xs" | "sm" | "default";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const handle = () =>
    startTransition(async () => {
      const res = await signByAclr(signatureId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Contre-signé par le commercial · deal sorti du pipeline.");
      router.refresh();
      onSuccess?.();
    });
  return (
    <Button
      type="button"
      size={size}
      onClick={handle}
      disabled={pending}
      className={className}
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <PenLine aria-hidden="true" />
      )}
      {pending ? "Signature..." : "Signer (commercial)"}
    </Button>
  );
}
