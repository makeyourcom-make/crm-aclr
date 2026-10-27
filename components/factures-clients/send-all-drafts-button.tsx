"use client";

/**
 * Envoi GROUPÉ des factures en brouillon : le geste « début de mois ».
 *
 * Le cron génère chaque 1er du mois les mensualités dues en BROUILLON. Ce
 * bouton permet de toutes les envoyer d'un clic (chacune avec son PDF + email
 * par défaut), sans ouvrir 17 dialogues.
 *
 * Design : la boucle tourne CÔTÉ CLIENT (un appel serveur par facture) plutôt
 * que dans une seule action serveur : évite tout timeout de fonction sur un lot
 * qui grossit, et donne une progression réelle « X / N envoyées ». Chaque envoi
 * réutilise exactement `sendClientInvoiceByEmail` (dating, PDF, QR-bill,
 * archivage, passage ENVOYEE) : zéro logique dupliquée.
 *
 * Sécurité d'usage : confirmation obligatoire (nombre + total), les clients
 * sans email sont listés et ignorés (jamais d'envoi dans le vide), et un échec
 * sur une facture n'interrompt pas les suivantes (rapport détaillé à la fin).
 */
import { LoaderCircle, Send } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { sendClientInvoiceByEmail } from "@/app/(app)/factures-clients/actions";
import { xpToast } from "@/components/arena/celebrate";
import { Button } from "@/components/ui/button";
import { XP_RULES } from "@/lib/gamification/rules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DraftInvoice {
  id: string;
  numero: string;
  clientName: string;
  clientEmail: string | null;
  total: number;
  devise: string;
}

export function SendAllDraftsButton({
  drafts,
  variant = "default",
  label,
  className,
}: {
  drafts: DraftInvoice[];
  /** `hero` : CTA dégradé coral du bandeau héros (un par écran). */
  variant?: "default" | "hero" | "outline";
  /** Libellé du déclencheur (défaut : « Envoyer tous les brouillons (N) »). */
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const sendable = useMemo(
    () => drafts.filter((d) => d.clientEmail && d.clientEmail.trim()),
    [drafts],
  );
  const skipped = useMemo(
    () => drafts.filter((d) => !d.clientEmail || !d.clientEmail.trim()),
    [drafts],
  );

  // Totaux par devise (les factures peuvent être en CHF ou EUR).
  const totalsByDevise = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of sendable) m.set(d.devise, (m.get(d.devise) ?? 0) + d.total);
    return [...m.entries()].map(
      ([devise, total]) =>
        `${new Intl.NumberFormat("fr-CH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(total)} ${devise}`,
    );
  }, [sendable]);

  if (drafts.length === 0) return null;

  const handleSendAll = () => {
    startTransition(async () => {
      let sent = 0;
      const failures: { numero: string; error: string }[] = [];
      setProgress({ done: 0, total: sendable.length });
      // Séquentiel : évite de saturer Resend/Blob et rend la progression lisible.
      for (const d of sendable) {
        try {
          const res = await sendClientInvoiceByEmail(d.id);
          if (res.ok) sent++;
          else failures.push({ numero: d.numero, error: res.error ?? "échec" });
        } catch (e) {
          failures.push({
            numero: d.numero,
            error: e instanceof Error ? e.message : "erreur",
          });
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      setProgress(null);
      setOpen(false);
      router.refresh();

      if (failures.length === 0) {
        if (sent > 0) {
          // Chaque envoi crée une activité EMAIL_ENVOYE : +3 XP par facture.
          xpToast(
            sent * XP_RULES.email,
            `${sent} facture${sent > 1 ? "s" : ""} envoyée${sent > 1 ? "s" : ""} !`,
            skipped.length
              ? `${skipped.length} ignorée(s), sans email client`
              : totalsByDevise.join(" + "),
          );
        } else {
          toast.success("Aucune facture envoyée.");
        }
      } else {
        toast.error(
          `${sent} envoyée(s), ${failures.length} en échec : ${failures
            .map((f) => f.numero)
            .join(", ")}`,
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <Button
        type="button"
        variant={variant}
        size={variant === "hero" ? "xl" : "lg"}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Send aria-hidden="true" />
        {label ?? `Envoyer tous les brouillons (${sendable.length})`}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">
            Envoyer les factures en brouillon
          </DialogTitle>
          <DialogDescription>
            Chaque client reçoit un email avec sa facture en PDF (facture +
            QR-bill + CGV). Le sujet et le corps par défaut sont utilisés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-[14px] border border-gold-500 bg-gold-50 p-4">
            <p className="text-[15px] font-extrabold text-foreground">
              Prêt à lancer {sendable.length} facture
              {sendable.length > 1 ? "s" : ""}
              {totalsByDevise.length > 0 && (
                <> · total {totalsByDevise.join(" + ")}</>
              )}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-gold-700">
              Chaque client reçoit son PDF avec QR-bill, avec une copie archivée
              dans sa timeline. +{XP_RULES.email} XP par envoi.
            </p>
          </div>

          {skipped.length > 0 && (
            <div className="rounded-[14px] border border-alert-500/40 bg-alert-50 p-3.5 text-alert-700">
              <p className="font-bold">
                {skipped.length} facture(s) ignorée(s), pas d&apos;email client :
              </p>
              <ul className="mt-1 list-inside list-disc text-[13px]">
                {skipped.map((d) => (
                  <li key={d.id}>
                    {d.numero} · {d.clientName}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">
                Renseigne l&apos;email sur la fiche client puis renvoie-les
                individuellement.
              </p>
            </div>
          )}

          {progress && (
            <div className="space-y-1.5" role="status" aria-live="polite">
              <p className="text-center text-sm font-semibold text-muted-foreground">
                Envoi en cours... {progress.done} / {progress.total}
              </p>
              <div className="h-2.5 overflow-hidden rounded-full bg-coral-100">
                <div
                  className="h-full rounded-full bg-gradient-coral transition-[width] duration-500"
                  style={{
                    width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleSendAll}
            disabled={pending || sendable.length === 0}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {pending
              ? `Envoi... ${progress?.done ?? 0}/${progress?.total ?? sendable.length}`
              : `Envoyer ${sendable.length} facture(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
