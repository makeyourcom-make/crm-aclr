"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  renameCategorieLabel,
  setProductCategorie,
} from "@/app/(app)/catalogue/actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface CatProduct {
  id: string;
  nom: string;
  isActive: boolean;
}
interface Category {
  code: string;
  label: string;
  count: number;
  products: CatProduct[];
}

export function CategoriesManager({
  categories,
}: {
  categories: Category[];
}) {
  return (
    <div className="mt-4 space-y-3">
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

  const handleRename = () => {
    startTransition(async () => {
      const res = await renameCategorieLabel({ code: cat.code, label: label.trim() });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Catégorie renommée ✓");
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
      toast.success("Produit déplacé ✓");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {cat.code}
          </span>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-9 max-w-xs"
            aria-label={`Nom de la catégorie ${cat.code}`}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleRename}
            disabled={!dirty || pending}
          >
            <Icon name="Save" className="mr-1.5 h-3.5 w-3.5" />
            Renommer
          </Button>
          <span className="text-sm text-muted-foreground">
            {cat.count} produit{cat.count > 1 ? "s" : ""}
          </span>
          {cat.count > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Icon
                name={expanded ? "ChevronDown" : "ChevronRight"}
                className="h-3.5 w-3.5"
              />
              {expanded ? "Masquer" : "Voir / réaffecter les produits"}
            </button>
          )}
        </div>

        {expanded && (
          <div className="divide-y divide-border rounded-md border border-border">
            {cat.products.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {p.nom}
                  {!p.isActive && (
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      (inactif)
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  Déplacer vers :
                </span>
                <select
                  defaultValue=""
                  disabled={pending}
                  onChange={(e) => {
                    if (e.target.value) handleMove(p.id, e.target.value);
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">— choisir —</option>
                  {allCategories
                    .filter((c) => c.code !== cat.code)
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
