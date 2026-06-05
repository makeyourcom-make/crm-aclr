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

type Mode = "fromToday" | "month" | "fixedDate";

export function SocialImportForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  const [mode, setMode] = useState<Mode>("fromToday");

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [fixedDate, setFixedDate] = useState("");
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
        rawInput,
        mode,
        ...(mode === "month" ? { yearMonth } : {}),
        ...(mode === "fixedDate" ? { fixedDate } : {}),
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

      {/* Mode de distribution */}
      <fieldset className="space-y-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quand démarrer la séquence pour ces prospects ?
        </legend>

        <ModeOption
          mode="fromToday"
          current={mode}
          onChange={setMode}
          label="🚀 À partir d'aujourd'hui — recommandé"
          hint="10 prospects par jour ouvrable, en avançant dans le futur. Tu commences ta séquence dès aujourd'hui sans rien avoir en retard."
          disabled={pending}
        />
        <ModeOption
          mode="month"
          current={mode}
          onChange={setMode}
          label="📅 Étalés sur un mois spécifique"
          hint="Pour planifier en avance (ex. import en mai pour démarrer en juin). 10/jour ouvrable du mois choisi."
          disabled={pending}
        >
          {mode === "month" && (
            <Input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="mt-2 w-48"
              disabled={pending}
            />
          )}
        </ModeOption>
        <ModeOption
          mode="fixedDate"
          current={mode}
          onChange={setMode}
          label="📌 Tous le même jour (exceptionnel)"
          hint="⚠️ Tous les prospects auront cette date de démarrage. À n'utiliser que pour une raison spécifique (relance batch, événement, etc.)."
          disabled={pending}
        >
          {mode === "fixedDate" && (
            <Input
              type="date"
              value={fixedDate}
              onChange={(e) => setFixedDate(e.target.value)}
              className="mt-2 w-48"
              disabled={pending}
              required
            />
          )}
        </ModeOption>
      </fieldset>

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
          Format toléré : <code>Nom | URL</code> (séparateurs <code>|</code> /{" "}
          <code>¦</code> / <code>;</code> / tab) ou juste l&apos;URL — dans ce
          cas le nom est deviné depuis le dernier segment.
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

function ModeOption({
  mode,
  current,
  onChange,
  label,
  hint,
  disabled,
  children,
}: {
  mode: Mode;
  current: Mode;
  onChange: (m: Mode) => void;
  label: string;
  hint: string;
  disabled: boolean;
  children?: React.ReactNode;
}) {
  const selected = current === mode;
  return (
    <label
      className={`block cursor-pointer rounded-md border p-2 transition-colors ${
        selected
          ? "border-primary/40 bg-primary/5"
          : "border-border hover:bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="radio"
          name="import-mode"
          value={mode}
          checked={selected}
          onChange={() => onChange(mode)}
          disabled={disabled}
          className="mt-1"
        />
        <div className="flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
          {children}
        </div>
      </div>
    </label>
  );
}
