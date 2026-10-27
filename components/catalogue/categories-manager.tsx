"use client";

import { ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createCategorie,
  deleteCategorie,
  renameCategorieLabel,
  setProductCategorie,
} from "@/app/(app)/catalogue/actions";
import { StatusPill } from "@/components/arena/pills";
import {
  FIELD_CLASS,
  SELECT_SM_CLASS,
} from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CatProduct {
  id: string;
  nom: string;
  isActive: boolean;
}
interface Category {
  code: string;
  label: string;
  systeme: boolean;
  count: number;
  products: CatProduct[];
}

export function CategoriesManager({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");

  const handleCreate = () => {
    if (newLabel.trim().length < 2) {
      toast.error("Donne un nom à la catégorie.");
      return;
    }
    startTransition(async () => {
      const res = await createCategorie({ label: newLabel.trim() });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(`Catégorie « ${newLabel.trim()} » créée.`);
      setNewLabel("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {/* Ajouter une catégorie */}
      <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-dashed border-border-strong bg-card p-3">
        <span
          aria-hidden="true"
          className="hidden size-9 shrink-0 items-center justify-center rounded-[12px] bg-navy-100 text-navy-700 sm:flex"
        >
          <Plus className="size-4" />
        </span>
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Nom de la nouvelle catégorie</span>
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="Nom d'une nouvelle catégorie…"
            className={FIELD_CLASS}
          />
        </label>
        <Button type="button" size="lg" onClick={handleCreate} disabled={pending}>
          Ajouter la catégorie
        </Button>
      </div>

      {categories.map((cat) => (
        <CategoryCard key={cat.code} cat={cat} allCategories={categories} />
      ))}
    </div>
  );
}

function CategoryCard({
  cat,
  allCategories,
}: {
  cat: Category;
  allCategories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(cat.label);
  const [expanded, setExpanded] = useState(false);

  const dirty = label.trim() !== cat.label && label.trim().length > 0;
  const panelId = `cat-products-${cat.code}`;

  const handleRename = () => {
    startTransition(async () => {
      const res = await renameCategorieLabel({ code: cat.code, label: label.trim() });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Catégorie renommée.");
      router.refresh();
    });
  };

  const handleMove = (productId: string, code: string) => {
    startTransition(async () => {
      const res = await setProductCategorie({ productId, code });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Produit déplacé.");
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm(`Supprimer la catégorie « ${cat.label} » ?`)) return;
    startTransition(async () => {
      const res = await deleteCategorie(cat.code);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Catégorie supprimée.");
      router.refresh();
    });
  };

  return (
    <div className="rounded-[20px] border border-border bg-card p-4 shadow-arena sm:p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-[8px] bg-navy-50 px-2 py-1 font-mono text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {cat.code}
        </span>
        {cat.systeme && (
          <StatusPill tone="blue" dot={false}>
            Système
          </StatusPill>
        )}
        <span className="text-sm font-semibold text-muted-foreground">
          {cat.count} produit{cat.count > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Nom de la catégorie {cat.code}</span>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <Button
          type="button"
          size="lg"
          onClick={handleRename}
          disabled={!dirty || pending}
        >
          <Save aria-hidden="true" />
          Renommer
        </Button>
        {!cat.systeme && cat.count === 0 && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="inline-flex size-11 items-center justify-center rounded-[12px] border border-border-strong text-muted-foreground transition-colors hover:border-alert-500/40 hover:bg-alert-50 hover:text-alert-700 disabled:opacity-50"
            title="Supprimer cette catégorie"
            aria-label={`Supprimer la catégorie ${cat.label}`}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        )}
        {cat.count > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="inline-flex h-11 items-center gap-1.5 rounded-[12px] px-3 text-sm font-bold text-info-700 transition-colors hover:bg-info-50 sm:ml-auto"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn("size-4 transition-transform", expanded && "rotate-90")}
            />
            {expanded ? "Masquer" : "Voir / réaffecter les produits"}
          </button>
        )}
      </div>

      {expanded && (
        <div
          id={panelId}
          className="mt-3 divide-y divide-border overflow-hidden rounded-[14px] border border-border"
        >
          {cat.products.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-semibold">
                {p.nom}
                {!p.isActive && (
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    (inactif)
                  </span>
                )}
              </span>
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Déplacer vers :
                </span>
                <select
                  defaultValue=""
                  disabled={pending}
                  onChange={(e) => {
                    if (e.target.value) handleMove(p.id, e.target.value);
                  }}
                  className={cn(SELECT_SM_CLASS, "w-auto min-w-[150px]")}
                >
                  <option value="">Choisir</option>
                  {allCategories
                    .filter((c) => c.code !== cat.code)
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
