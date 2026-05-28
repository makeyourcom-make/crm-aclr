"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  generateInvoiceAction,
  markInvoiceEnvoyee,
  markInvoicePayee,
} from "@/app/(app)/factures/actions";
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
import { Label } from "@/components/ui/label";

const MOIS = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

interface GenerateInvoiceButtonProps {
  users: Array<{ id: string; name: string }>;
}

/** Bouton admin : génère manuellement la facture d'un user pour un mois donné. */
export function GenerateInvoiceButton({ users }: GenerateInvoiceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const now = new Date();
  // Par défaut : mois précédent (= ce qu'on facture début du mois suivant)
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [annee, setAnnee] = useState(prevYear);
  const [mois, setMois] = useState(prevMonth);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await generateInvoiceAction({ userId, annee, mois });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(`Facture ${res.numero} générée !`);
      setOpen(false);
      router.push(`/factures/${res.invoiceId}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
        Générer une facture
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Générer une facture mensuelle</DialogTitle>
          <DialogDescription>
            Calcule automatiquement les commissions acquises sur le mois +
            applique la garantie absorbable + ajoute le forfait frais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="userId">Commerciale</Label>
            <select
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              required
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mois">Mois</Label>
              <select
                id="mois"
                value={mois}
                onChange={(e) => setMois(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                {MOIS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="annee">Année</Label>
              <select
                id="annee"
                value={annee}
                onChange={(e) => setAnnee(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
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
              {pending ? "Génération…" : "Générer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface InvoiceStatusButtonsProps {
  invoiceId: string;
  statut: "BROUILLON" | "ENVOYEE" | "PAYEE";
  isAdmin: boolean;
}

export function InvoiceStatusButtons({
  invoiceId,
  statut,
  isAdmin,
}: InvoiceStatusButtonsProps) {
  const [pending, startTransition] = useTransition();

  const handleEnvoyee = () =>
    startTransition(async () => {
      const res = await markInvoiceEnvoyee(invoiceId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Marquée envoyée.");
    });

  const handlePayee = () =>
    startTransition(async () => {
      const res = await markInvoicePayee({ invoiceId });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Marquée payée. Versement Sophie effectué.");
    });

  return (
    <div className="flex gap-2">
      {statut === "BROUILLON" && (
        <Button onClick={handleEnvoyee} disabled={pending} variant="outline">
          Marquer envoyée
        </Button>
      )}
      {statut === "ENVOYEE" && isAdmin && (
        <Button onClick={handlePayee} disabled={pending}>
          Marquer payée
        </Button>
      )}
    </div>
  );
}
