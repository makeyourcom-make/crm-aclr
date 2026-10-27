"use client";

/**
 * Gestion des filtres anti-spam : ajout / activation / suppression de règles.
 * Un mail entrant qui matche une règle active part dans le dossier Spam
 * (récupérable via « Pas un spam »). À la création d'une règle, les mails
 * déjà reçus qui la matchent sont déplacés à la corbeille (récupérables).
 *
 * tuiles de synthèse (règles actives, mails bloqués), recherche
 * dans les règles, lignes à pastilles.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";

import {
  addBlockRule,
  deleteBlockRule,
  toggleBlockRule,
} from "@/app/(app)/emails/actions";
import { formatInt } from "@/components/arena/format";
import { SectionCard } from "@/components/arena/section-card";
import { StatTile } from "@/components/arena/stat-tile";
import { FIELD_CLASS, uiText } from "@/components/emails/mail-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [filter, setFilter] = useState("");

  const activeCount = initialRules.filter((r) => r.actif).length;
  const blockedTotal = initialRules.reduce((s, r) => s + r.nbBloques, 0);
  const visibleRules = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return initialRules;
    return initialRules.filter(
      (r) => r.value.toLowerCase().includes(q) || TYPE_LABEL[r.type].toLowerCase().includes(q),
    );
  }, [initialRules, filter]);

  const submit = () => {
    if (!value.trim()) return;
    startTransition(async () => {
      const res = await addBlockRule(type, value.trim());
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(
        `Règle ajoutée${res.moved ? ` : ${res.moved} mail(s) déjà reçu(s) mis à la corbeille` : ""}.`,
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
    <div className="flex flex-col gap-5">
      {/* Synthèse */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        <StatTile
          label="Règles actives"
          value={activeCount}
          sub={`sur ${formatInt(initialRules.length)} règle${initialRules.length > 1 ? "s" : ""}`}
          tone="teal"
          icon={ShieldCheck}
        />
        <StatTile
          label="Mails bloqués"
          value={blockedTotal}
          sub="depuis la création des règles"
          tone="gold"
          icon={ShieldBan}
        />
      </div>

      {/* Ajout */}
      <SectionCard
        title="Bloquer un expéditeur, un domaine ou un sujet"
        icon={ShieldBan}
        tone="teal"
        description="Le filtre est partagé par toute l'équipe."
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground">
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Rule["type"])}
              className={cn(FIELD_CLASS, "w-auto min-w-[200px] font-semibold")}
            >
              <option value="DOMAIN">Domaine</option>
              <option value="SENDER">Expéditeur (adresse)</option>
              <option value="SUBJECT">Sujet contient</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 text-xs font-bold text-muted-foreground">
            Valeur
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={PLACEHOLDER[type]}
              className={cn(FIELD_CLASS, "font-semibold")}
            />
          </label>
          <Button
            type="button"
            size="lg"
            onClick={submit}
            disabled={pending || !value.trim()}
          >
            <ShieldBan aria-hidden="true" />
            Bloquer
          </Button>
        </div>
      </SectionCard>

      {/* Liste */}
      <SectionCard
        title="Règles"
        icon={ShieldCheck}
        tone="navy"
        description={`${formatInt(activeCount)} active${activeCount > 1 ? "s" : ""} · ${formatInt(initialRules.length - activeCount)} inactive${initialRules.length - activeCount > 1 ? "s" : ""}`}
        action={
          initialRules.length > 6 ? (
            <div className="relative w-full min-w-[200px] sm:w-64">
              <label htmlFor="spam-rule-filter" className="sr-only">
                Rechercher une règle
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="spam-rule-filter"
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Rechercher une règle…"
                className={cn(FIELD_CLASS, "h-10 bg-ground pl-9")}
              />
            </div>
          ) : undefined
        }
      >
        {initialRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune règle. Ajoute-en une, ou clique sur le bouclier d&apos;un mail
            indésirable pour bloquer son expéditeur.
          </p>
        ) : visibleRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune règle ne correspond à « {filter.trim()} ».</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleRules.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-[12px] border px-3 py-2",
                  r.actif
                    ? "border-transparent bg-ground"
                    : "border-dashed border-border-strong bg-card",
                )}
              >
                <span className="shrink-0 rounded-full border border-border-strong bg-card px-2.5 py-0.5 text-[11px] font-bold text-navy-600">
                  {TYPE_LABEL[r.type]}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-[1_1_160px] truncate font-mono text-[13px] font-bold",
                    r.actif ? "text-foreground" : "text-muted-foreground line-through",
                  )}
                >
                  {r.value}
                </span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                  {formatInt(r.nbBloques)} bloqué{r.nbBloques > 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  disabled={pending}
                  aria-pressed={r.actif}
                  className={cn(
                    "h-7 shrink-0 rounded-full px-3 text-xs font-extrabold transition-[filter] hover:brightness-95 disabled:opacity-50",
                    r.actif ? "bg-win-50 text-win-700" : "bg-navy-100 text-navy-600",
                  )}
                  title={r.actif ? "Désactiver" : "Activer"}
                >
                  {r.actif ? "Actif" : "Inactif"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(r)}
                  disabled={pending}
                  className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-alert-50 hover:text-alert-700 disabled:opacity-50"
                  title="Supprimer la règle"
                  aria-label={`Supprimer la règle ${r.value}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Les mails bloqués ne sont jamais perdus : à la réception ils vont dans le
        dossier <strong className="font-bold text-foreground">Spam</strong> (récupérables via
        « Pas un spam »), et ceux déjà reçus au moment où tu crées une règle partent à la{" "}
        <strong className="font-bold text-foreground">Corbeille</strong>. Un mail d&apos;un client
        enregistré n&apos;est jamais bloqué, quelle que soit la règle.
      </p>
    </div>
  );
}
