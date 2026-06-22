"use client";

/**
 * Éditeur de tags d'un prospect (sur la fiche).
 *
 * - Affiche les tags actuellement assignés (pills colorées)
 * - Si canEdit (admin OU commercial propriétaire) : ajouter/retirer + créer un
 *   nouveau tag à la volée (ex. "Passeport Beauté")
 * - Sinon : lecture seule
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createTag, setProspectTags } from "@/app/(app)/prospects/tags-actions";
import { Icon } from "@/components/icon";

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

interface TagOption {
  id: string;
  nom: string;
  couleur: string;
}

interface ProspectTagsEditorProps {
  prospectId: string;
  /** Tags actuellement assignés à ce prospect */
  currentTags: TagOption[];
  /** Tous les tags disponibles dans l'app */
  allTags: TagOption[];
  /** Si false (commercial) : affichage lecture seule */
  canEdit: boolean;
}

export function ProspectTagsEditor({
  prospectId,
  currentTags,
  allTags,
  canEdit,
}: ProspectTagsEditorProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    currentTags.map((t) => t.id),
  );
  // Liste locale des tags disponibles (allTags + ceux créés à la volée).
  const [tags, setTags] = useState<TagOption[]>(allTags);
  const [newTagName, setNewTagName] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleCreateTag = () => {
    const nom = newTagName.trim();
    if (nom.length < 1) return;
    if (tags.some((t) => t.nom.toLowerCase() === nom.toLowerCase())) {
      toast.error("Ce tag existe déjà.");
      return;
    }
    startTransition(async () => {
      const res = await createTag({ nom, couleur: "purple" });
      if (!res.ok || !res.id) {
        toast.error(res.error ?? "Échec de la création du tag.");
        return;
      }
      const created = { id: res.id, nom, couleur: "purple" };
      setTags((prev) => [...prev, created]);
      setSelected((prev) => [...prev, created.id]);
      setNewTagName("");
      toast.success(`Tag « ${nom} » créé et sélectionné ✓`);
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await setProspectTags(prospectId, selected);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Tags mis à jour ✓");
      setOpen(false);
      router.refresh();
    });
  };

  const toggleTag = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Lecture seule pour Sophie
  if (!canEdit) {
    if (currentTags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {currentTags.map((t) => (
          <TagPill key={t.id} nom={t.nom} couleur={t.couleur} />
        ))}
      </div>
    );
  }

  // Mode édition (admin)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {currentTags.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">
            Aucun tag
          </span>
        ) : (
          currentTags.map((t) => (
            <TagPill key={t.id} nom={t.nom} couleur={t.couleur} />
          ))
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border bg-background px-2 text-xs hover:bg-muted"
        >
          <Icon name="Plus" className="h-3 w-3" />
          Modifier
        </button>
      </div>

      {open && (
        <div className="rounded-lg border border-border bg-popover p-3 shadow-sm space-y-2 max-w-md">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Choisir les tags
          </p>
          {tags.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun tag pour l&apos;instant — crée le premier ci-dessous.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const isSelected = selected.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all ${
                      isSelected
                        ? `${COLOR_CLASSES[t.couleur] ?? COLOR_CLASSES.slate} ring-2 ring-offset-1 ring-primary/40`
                        : "border border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                    disabled={pending}
                  >
                    {isSelected && <Icon name="Check" className="h-3 w-3" />}
                    {t.nom}
                  </button>
                );
              })}
            </div>
          )}
          {/* Créer un nouveau tag à la volée */}
          <div className="flex items-center gap-1.5 border-t border-border pt-2">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateTag();
                }
              }}
              placeholder="Nouveau tag (ex. Passeport Beauté)…"
              disabled={pending}
              className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={handleCreateTag}
              disabled={pending || newTagName.trim().length < 1}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
            >
              <Icon name="Plus" className="h-3 w-3" />
              Créer
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSelected(currentTags.map((t) => t.id));
              }}
              disabled={pending}
              className="text-xs text-muted-foreground hover:underline"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TagPill({ nom, couleur }: { nom: string; couleur: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        COLOR_CLASSES[couleur] ?? COLOR_CLASSES.slate
      }`}
    >
      {nom}
    </span>
  );
}
