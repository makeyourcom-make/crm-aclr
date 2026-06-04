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
  createTag,
  deleteTag,
  updateTag,
  type TagColorOption,
} from "@/app/(app)/prospects/tags-actions";
import { Icon } from "@/components/icon";
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_CLASSES[couleur] ?? COLOR_CLASSES.slate}`}
    >
      <Icon name="Sparkles" className="h-3 w-3" />
      {nom}
    </span>
  );
}

const COLOR_CLASSES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-800",
  emerald: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-800",
  purple: "bg-purple-100 text-purple-800",
  cyan: "bg-cyan-100 text-cyan-800",
  orange: "bg-orange-100 text-orange-800",
};

export function TagsManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setCreating(true)}>
          <Icon name="Plus" className="mr-1.5 h-4 w-4" />
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

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
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
                  className="px-4 py-8 text-center text-xs text-muted-foreground"
                >
                  Aucun tag pour l&apos;instant. Crée le premier avec
                  &quot;Nouveau tag&quot;.
                </td>
              </tr>
            ) : (
              tags.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <TagPill nom={t.nom} couleur={t.couleur} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t.description ?? <span className="italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    {t.nbProspects} entreprise
                    {t.nbProspects > 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(t)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Modifier"
                      >
                        <Icon name="Pencil" className="h-3.5 w-3.5" />
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
      toast.success(initial ? "Tag modifié ✓" : "Tag créé ✓");
      onClose();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
    >
      <p className="text-sm font-medium">
        {initial ? `Modifier "${initial.nom}"` : "Nouveau tag"}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tag-nom">
            Nom <span className="text-red-500">*</span>
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
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  couleur === c
                    ? "border-foreground scale-110"
                    : "border-transparent"
                } ${COLOR_CLASSES[c]?.split(" ")[0] ?? ""}`}
                title={c}
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
          {pending ? "…" : initial ? "Enregistrer" : "Créer"}
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
        ? `Supprimer "${nom}" ? Le tag sera retiré de ${nbProspects} entreprise(s).`
        : `Supprimer "${nom}" ?`;
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
      className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
      title="Supprimer"
    >
      <Icon name="Trash2" className="h-3.5 w-3.5" />
    </button>
  );
}
