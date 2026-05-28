"use client";

/**
 * Bouton "Enregistrer un paiement" sur la fiche d'un contrat.
 *
 * Ouvre une modale avec :
 *   - date (default = aujourd'hui)
 *   - montant
 *   - type (ACOMPTE / SOLDE / MENSUALITE)
 *   - facture client à laquelle il se rattache (optionnel mais conseillé)
 *   - statut (ENCAISSE par défaut → déclenche la cascade)
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createPayment } from "@/app/(app)/paiements/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCHF } from "@/lib/format";

import type { PaymentType } from "@prisma/client";

interface FactureOption {
  id: string;
  numero: string;
  type: string;
  total: string; // Decimal sérialisé
  statut: string;
}

interface RecordPaymentButtonProps {
  contractId: string;
  /** Factures encore impayées du contrat pour aider à pré-remplir. */
  factures: FactureOption[];
}

const TYPE_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: "ACOMPTE", label: "Acompte" },
  { value: "SOLDE", label: "Solde" },
  { value: "MENSUALITE", label: "Mensualité" },
];

function todayLocalIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TYPE_MAP: Record<string, PaymentType> = {
  ACOMPTE: "ACOMPTE",
  SOLDE: "SOLDE",
  MENSUALITE: "MENSUALITE",
  PONCTUELLE: "SOLDE",
  ANNUELLE: "SOLDE",
};

export function RecordPaymentButton({
  contractId,
  factures,
}: RecordPaymentButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // États
  const [clientInvoiceId, setClientInvoiceId] = useState("");
  const [date, setDate] = useState(todayLocalIso());
  const [montant, setMontant] = useState("");
  const [type, setType] = useState<PaymentType>("ACOMPTE");
  const [reference, setReference] = useState("");

  // Quand l'utilisateur sélectionne une facture, on pré-remplit
  // montant / type / référence
  const handleSelectFacture = (id: string) => {
    setClientInvoiceId(id);
    const f = factures.find((x) => x.id === id);
    if (f) {
      setMontant(f.total);
      setType(TYPE_MAP[f.type] ?? "SOLDE");
      setReference(f.numero);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!montant || Number(montant) <= 0) {
      toast.error("Montant invalide.");
      return;
    }
    startTransition(async () => {
      const res = await createPayment({
        contractId,
        clientInvoiceId: clientInvoiceId || undefined,
        date: new Date(date),
        montant: Number(montant),
        type,
        statut: "ENCAISSE",
        referenceFactureClient: reference.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Paiement enregistré et encaissé.");
      setOpen(false);
      // Reset
      setClientInvoiceId("");
      setMontant("");
      setReference("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
        <Icon name="Banknote" className="h-4 w-4" />
        Enregistrer un paiement
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement reçu</DialogTitle>
          <DialogDescription>
            Le paiement est marqué encaissé immédiatement. Si c&apos;est le 1ᵉʳ
            paiement du contrat, la commission de signature est déclenchée
            automatiquement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {factures.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="facture">Facture couverte (optionnel)</Label>
              <select
                id="facture"
                value={clientInvoiceId}
                onChange={(e) => handleSelectFacture(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                <option value="">— Aucune ou paiement libre —</option>
                {factures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.numero} · {formatCHF(Number(f.total))}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Sélectionner une facture pré-remplit montant et type.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as PaymentType)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="montant">Montant (CHF)</Label>
            <Input
              id="montant"
              type="number"
              min={0.01}
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="2500.00"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reference">Référence facture (optionnel)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ACLR-CLI-2026-0001"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer & encaisser"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
