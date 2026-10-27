"use client";

/**
 * Gestion CRUD des tags d'entreprises (admin uniquement).
 *
 * Permet de créer, modifier, supprimer les tags utilisés sur les fiches
 * Prospects (ex. "Passeport Beauté", "VIP", etc.).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AVAILABLE_TAG_COLORS,
  type TagColorOption,
} from "@/app/(app)/prospects/tags-constants";
import {
  createTag,
  deleteTag,
  updateTag,
} from "@/app/(app)/prospects/tags-actions";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

import {
  TAG_COLOR_CLASSES as COLOR_CLASSES,
  TAG_COLOR_LABELS,
  TAG_SWATCH_CLASSES,
} from "./tag-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TagRow {
  id: string;
  nom: string;
  couleur: string;
  description: string | null;
  nbProspects: number;
}

/**
 * Pill visuelle d'un tag, couleur Tailwind dérivée du nom de couleur stocké.
 */
function TagPill({ nom, couleur }: { nom: string; couleur: string }) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-bold ${COLOR_CLASSES[couleur] ?? COLOR_CLASSES.slate}`}
    >
      <Sparkles aria-hidden="true" className="size-3" />
      {nom}
    </span>
  );
}

export function TagsManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" size="lg" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          Nouveau tag
        </Button>
      </div>

      {(creating || editing) && (
        <TagForm
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <div className="overflow-x-auto rounded-[20px] border border-border bg-card shadow-arena">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border bg-ground text-left text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Tag</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Utilisé</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tags.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-sm font-semibold text-muted-foreground"
                >
                  Aucun tag pour l&apos;instant. Crée le premier avec
                  &quot;Nouveau tag&quot;.
                </td>
              </tr>
            ) : (
              tags.map((t) => (
                <tr key={t.id} className="hover:bg-navy-50/60">
                  <td className="px-4 py-3">
                    <TagPill nom={t.nom} couleur={t.couleur} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t.description ?? <span className="text-subtle" aria-label="Aucune description">-</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold tabular-nums">
                    {t.nbProspects} entreprise
                    {t.nbProspects > 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(t)}
                        className="flex size-9 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-navy-50 hover:text-foreground"
                        title="Modifier"
                        aria-label={`Modifier le tag ${t.nom}`}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </button>
                      <DeleteButton
                        tagId={t.id}
                        nom={t.nom}
                        nbProspects={t.nbProspects}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TagForm({
  initial,
  onClose,
}: {
  initial: TagRow | null;
  onClose: () => void;
}) {
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [couleur, setCouleur] = useState<TagColorOption>(
    (initial?.couleur as TagColorOption) ?? "slate",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) {
      toast.error("Donne un nom.");
      return;
    }
    startTransition(async () => {
      const payload = {
        nom: nom.trim(),
        couleur,
        description: description.trim() || null,
      };
      const res = initial
        ? await updateTag(initial.id, payload)
        : await createTag(payload);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(initial ? "Tag modifié." : "Tag créé.");
      onClose();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-[20px] border border-border bg-card p-4 shadow-arena sm:p-5"
    >
      <p className="font-display text-lg font-extrabold">
        {initial ? `Modifier « ${initial.nom} »` : "Nouveau tag"}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tag-nom">
            Nom <span aria-hidden="true" className="text-coral-600">*</span>
          </Label>
          <Input
            id="tag-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex. Passeport Beauté"
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tag-couleur">Couleur</Label>
          <div className="flex flex-wrap gap-1">
            {AVAILABLE_TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCouleur(c)}
                aria-label={`Couleur ${TAG_COLOR_LABELS[c] ?? c}`}
                aria-pressed={couleur === c}
                className={`size-9 rounded-full border-2 transition-all ${
                  couleur === c
                    ? "scale-110 border-navy-700"
                    : "border-transparent"
                } ${TAG_SWATCH_CLASSES[c] ?? ""}`}
                title={TAG_COLOR_LABELS[c] ?? c}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tag-description">Description (optionnelle)</Label>
        <Input
          id="tag-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mémo interne pour l'équipe"
          disabled={pending}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : initial ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </form>
  );
}

function DeleteButton({
  tagId,
  nom,
  nbProspects,
}: {
  tagId: string;
  nom: string;
  nbProspects: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const handleClick = () => {
    const msg =
      nbProspects > 0
        ? `Supprimer « ${nom} » ? Le tag sera retiré de ${nbProspects} entreprise(s).`
        : `Supprimer « ${nom} » ?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await deleteTag(tagId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Tag supprimé.");
      router.refresh();
    });
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex size-9 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-alert-50 hover:text-alert-700 disabled:opacity-50"
      title="Supprimer"
      aria-label={`Supprimer le tag ${nom}`}
    >
      <Trash2 aria-hidden="true" className="size-3.5" />
    </button>
  );
}
