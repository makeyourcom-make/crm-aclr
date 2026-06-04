"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { bulkImportSocialProspects } from "@/app/(app)/social/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NETWORK_LABELS } from "@/lib/social-sequence";

interface AccountOption {
  id: string;
  nom: string;
  reseau: string;
  responsable: { name: string };
}

export function SocialImportForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [forceStartDate, setForceStartDate] = useState("");
  const [rawInput, setRawInput] = useState("");

  const lines = rawInput
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      toast.error("Choisis un compte.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Aucune ligne à importer.");
      return;
    }
    startTransition(async () => {
      const res = await bulkImportSocialProspects({
        accountId,
        yearMonth,
        rawInput,
        forceStartDate: forceStartDate || undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      const errs = res.errors ?? [];
      if (errs.length > 0) {
        toast.warning(
          `${res.count} importé(s), ${errs.length} erreur(s) ignorée(s).`,
        );
      } else {
        toast.success(`${res.count} prospect(s) importé(s) ✓`);
      }
      setRawInput("");
      router.push("/social/aujourdhui");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="account">Compte</Label>
        <select
          id="account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
          disabled={pending}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom} · {NETWORK_LABELS[a.reseau] ?? a.reseau} ·{" "}
              {a.responsable.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="yearMonth">
            Mois de référence (distribution automatique)
          </Label>
          <Input
            id="yearMonth"
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            disabled={pending || !!forceStartDate}
          />
          <p className="text-[11px] text-muted-foreground">
            10 prospects par jour ouvrable (lun-ven).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="forceStart">
            Ou : forcer tous à démarrer un jour précis
          </Label>
          <Input
            id="forceStart"
            type="date"
            value={forceStartDate}
            onChange={(e) => setForceStartDate(e.target.value)}
            disabled={pending}
          />
          <p className="text-[11px] text-muted-foreground">
            Optionnel — écrase la distribution mensuelle.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="raw">
          Liste des prospects ({lines.length} ligne(s) détectée(s))
        </Label>
        <textarea
          id="raw"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          rows={14}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={`Format : "Nom | URL" (un par ligne) ou juste URL\n\nExemples :\nSophie Dupont | https://www.instagram.com/sophiedp\nhttps://www.linkedin.com/in/jean-martin`}
          disabled={pending}
        />
        <p className="text-[11px] text-muted-foreground">
          Format toléré : <code>Nom | URL</code> (séparé par <code>|</code>) ou
          juste l&apos;URL — dans ce cas le nom est deviné depuis le dernier
          segment de l&apos;URL.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/social/aujourdhui")}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending || lines.length === 0}>
          {pending
            ? "Import en cours…"
            : `Importer ${lines.length} prospect(s)`}
        </Button>
      </div>
    </form>
  );
}
