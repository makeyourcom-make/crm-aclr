"use client";

/**
 * Gestion des filtres anti-spam : ajout / activation / suppression de règles.
 * Un mail entrant matchant une règle active part à la corbeille (récupérable).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addBlockRule,
  deleteBlockRule,
  toggleBlockRule,
} from "@/app/(app)/emails/actions";
import { Icon } from "@/components/icon";

interface Rule {
  id: string;
  type: "SENDER" | "DOMAIN" | "SUBJECT";
  value: string;
  actif: boolean;
  nbBloques: number;
}

const TYPE_LABEL: Record<Rule["type"], string> = {
  SENDER: "Expéditeur",
  DOMAIN: "Domaine",
  SUBJECT: "Sujet contient",
};

const PLACEHOLDER: Record<Rule["type"], string> = {
  SENDER: "spam@exemple.com",
  DOMAIN: "exemple.com",
  SUBJECT: "rabatt",
};

export function SpamRulesManager({ initialRules }: { initialRules: Rule[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<Rule["type"]>("DOMAIN");
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    startTransition(async () => {
      const res = await addBlockRule(type, value.trim());
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        `Règle ajoutée${res.moved ? ` — ${res.moved} mail(s) à la corbeille` : ""}.`,
      );
      setValue("");
      router.refresh();
    });
  };

  const toggle = (r: Rule) =>
    startTransition(async () => {
      await toggleBlockRule(r.id, !r.actif);
      router.refresh();
    });

  const remove = (r: Rule) =>
    startTransition(async () => {
      if (!confirm(`Supprimer la règle « ${r.value} » ?`)) return;
      await deleteBlockRule(r.id);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {/* Ajout */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Rule["type"])}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="DOMAIN">Domaine</option>
            <option value="SENDER">Expéditeur (adresse)</option>
            <option value="SUBJECT">Sujet contient</option>
          </select>
        </label>
        <label className="min-w-0 flex-1 text-xs">
          <span className="mb-1 block text-muted-foreground">Valeur</span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={PLACEHOLDER[type]}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Icon name="ShieldBan" className="h-4 w-4" />
          Bloquer
        </button>
      </div>

      {/* Liste */}
      {initialRules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune règle. Ajoute-en une, ou clique 🛡 sur un mail indésirable pour
          bloquer son expéditeur.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {initialRules.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 px-3 py-2 text-sm ${r.actif ? "" : "opacity-50"}`}
            >
              <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
                {TYPE_LABEL[r.type]}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                {r.value}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {r.nbBloques} bloqué{r.nbBloques > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => toggle(r)}
                disabled={pending}
                className="shrink-0 rounded border border-border px-2 py-0.5 text-[11px] hover:bg-muted"
                title={r.actif ? "Désactiver" : "Activer"}
              >
                {r.actif ? "Actif" : "Inactif"}
              </button>
              <button
                type="button"
                onClick={() => remove(r)}
                disabled={pending}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700"
                title="Supprimer la règle"
              >
                <Icon name="Trash2" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Les mails bloqués ne sont jamais perdus : ils vont dans la{" "}
        <strong>Corbeille</strong> et restent récupérables. Un mail d&apos;un
        client enregistré n&apos;est jamais bloqué, quelle que soit la règle.
      </p>
    </div>
  );
}
