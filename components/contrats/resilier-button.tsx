"use client";

import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resilierContract } from "@/app/(app)/contrats/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function todayLocalIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ResilierButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [raison, setRaison] = useState("");
  const [date, setDate] = useState(todayLocalIso());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (raison.trim().length < 3) {
      toast.error("Précise la raison (min 3 caractères).");
      return;
    }
    startTransition(async () => {
      const res = await resilierContract({
        contractId,
        dateResiliation: new Date(date),
        raison: raison.trim(),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        "Contrat résilié. Les commissions PREVU restantes ont été annulées.",
      );
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-alert-500/40 bg-card px-3.5 text-sm font-bold text-alert-700 transition-colors hover:bg-alert-50">
        <Ban aria-hidden="true" className="size-4" />
        Résilier le contrat
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">
            Résilier le contrat ?
          </DialogTitle>
          <DialogDescription>
            Les versements de commission encore en statut <em>prévu</em>{" "}
            seront automatiquement annulés. Les versements déjà payés
            restent acquis. Cette action est réversible côté admin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dateResiliation">Date de résiliation</Label>
            <Input
              id="dateResiliation"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="raison">Raison</Label>
            <textarea
              id="raison"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              rows={3}
              className="w-full rounded-[12px] border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring/30 focus:outline-none"
              placeholder="Insatisfaction service, fermeture entreprise, etc."
              required
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
              type="submit"
              size="lg"
              disabled={pending}
              className="bg-alert-700 text-white hover:bg-alert-700/90"
            >
              {pending ? "Résiliation..." : "Confirmer la résiliation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
