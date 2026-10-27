"use client";

/**
 * Bouton « Marquer payée » sur une facture client (liste des factures, fiche
 * contrat). Ouvre une confirmation (date d'encaissement, aujourd'hui par
 * défaut) puis, en 1 clic :
 *   - crée un Payment ENCAISSE couvrant le montant total de la facture
 *   - marque la ClientInvoice PAYEE
 *   - déclenche la commission SIGNATURE si c'est le 1er paiement encaissé
 * Succès : toast sobre « Facture payée · +montant » et rafraîchissement de
 * la page (pas de confettis : réservés à la signature d'un contrat).
 */
import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { markClientInvoicePaid } from "@/app/(app)/paiements/actions";
import { resultToast } from "@/components/arena/celebrate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MarkInvoicePaidButtonProps {
  invoiceId: string;
  /** Si true, masque le bouton (facture déjà payée). */
  hidden?: boolean;
  /** Infos affichées dans la confirmation (optionnelles). */
  numero?: string;
  clientName?: string;
  total?: number;
  devise?: string;
  /** `compact` : petit bouton de tableau (36 px) ; `default` : 44 px. */
  size?: "compact" | "default";
  className?: string;
}

function todayLocalIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function MarkInvoicePaidButton({
  invoiceId,
  hidden,
  numero,
  clientName,
  total,
  devise = "CHF",
  size = "compact",
  className,
}: MarkInvoicePaidButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayLocalIso);
  const [pending, startTransition] = useTransition();
  if (hidden) return null;

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await markClientInvoicePaid({
        clientInvoiceId: invoiceId,
        // Aujourd'hui (valeur par défaut) : on laisse le serveur horodater
        // « maintenant », comme avant l'ajout du sélecteur de date.
        date: date && date !== todayLocalIso() ? new Date(date) : undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      setOpen(false);
      resultToast(
        total !== undefined
          ? `Facture payée · +${formatMoney(total, devise)} encaissés`
          : "Facture payée",
        clientName ?? "Encaissement enregistré",
      );
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        if (o) setDate(todayLocalIso());
        setOpen(o);
      }}
    >
      <Button
        type="button"
        onClick={() => {
          setDate(todayLocalIso());
          setOpen(true);
        }}
        className={cn(
          "bg-win-700 text-white hover:bg-win-700/90",
          size === "compact" ? "h-9 px-3 text-[13px]" : "h-11 px-4",
          className,
        )}
        aria-label={numero ? `Marquer payée la facture ${numero}` : undefined}
      >
        <Check aria-hidden="true" />
        Marquer payée
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">
            Marquer payée
          </DialogTitle>
          <DialogDescription>
            Crée un paiement « Encaissé », passe la facture en Payée et
            débloque la commission liée.
          </DialogDescription>
        </DialogHeader>

        {(clientName || numero || total !== undefined) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-ground p-3.5">
            <div className="min-w-0">
              {clientName && (
                <p className="truncate text-sm font-extrabold text-foreground">
                  {clientName}
                </p>
              )}
              {numero && (
                <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {numero}
                </p>
              )}
            </div>
            {total !== undefined && (
              <p className="score-number text-2xl whitespace-nowrap text-win-700">
                {formatMoney(total, devise)}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`paid-date-${invoiceId}`}>Date de paiement</Label>
          <Input
            id={`paid-date-${invoiceId}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={pending}
            className="h-11"
          />
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
            onClick={handleConfirm}
            disabled={pending}
            className="bg-win-700 text-white hover:bg-win-700/90"
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {pending ? "Encaissement..." : "Confirmer l'encaissement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
