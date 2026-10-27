"use client";

/**
 * Éditeur de tags d'un prospect (sur la fiche).
 *
 * - Affiche les tags actuellement assignés (pills colorées)
 * - Si canEdit (admin OU commercial propriétaire) : ajouter/retirer + créer un
 *   nouveau tag à la volée (ex. "Passeport Beauté")
 * - Sinon : lecture seule
 */
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createTag, setProspectTags } from "@/app/(app)/prospects/tags-actions";

import { TAG_COLOR_CLASSES as COLOR_CLASSES } from "./tag-colors";

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
      toast.success(`Tag « ${nom} » créé et sélectionné.`);
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await setProspectTags(prospectId, selected);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Tags mis à jour.");
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
          <span className="text-xs font-semibold text-muted-foreground">
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
          aria-expanded={open}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border-strong bg-card px-2.5 text-xs font-bold text-foreground hover:bg-navy-50"
        >
          <Plus aria-hidden="true" className="size-3" />
          {currentTags.length === 0 ? "Ajouter un tag" : "Modifier les tags"}
        </button>
      </div>

      {open && (
        <div className="max-w-md space-y-2.5 rounded-[14px] border border-border bg-popover p-3 shadow-arena">
          <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Choisir les tags
          </p>
          {tags.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun tag pour l&apos;instant : crée le premier ci-dessous.
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
                    aria-pressed={isSelected}
                    className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold transition-all ${
                      isSelected
                        ? `${COLOR_CLASSES[t.couleur] ?? COLOR_CLASSES.slate} ring-2 ring-navy-700/40 ring-offset-1`
                        : "border border-border-strong bg-card text-muted-foreground hover:bg-navy-50"
                    }`}
                    disabled={pending}
                  >
                    {isSelected && <Check aria-hidden="true" className="size-3" />}
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
              placeholder="Nouveau tag (ex. Passeport Beauté)"
              disabled={pending}
              aria-label="Nom du nouveau tag"
              className="h-9 min-w-0 flex-1 rounded-[10px] border border-border-strong bg-card px-2.5 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <button
              type="button"
              onClick={handleCreateTag}
              disabled={pending || newTagName.trim().length < 1}
              className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-border-strong bg-card px-2.5 text-xs font-bold hover:bg-navy-50 disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="size-3" />
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
              className="h-9 rounded-[10px] px-2 text-xs font-bold text-muted-foreground hover:underline"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="h-9 rounded-[10px] bg-navy-700 px-3 text-xs font-bold text-white hover:bg-navy-600 disabled:opacity-50"
            >
              {pending ? "Enregistrement..." : "Enregistrer"}
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
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold ${
        COLOR_CLASSES[couleur] ?? COLOR_CLASSES.slate
      }`}
    >
      {nom}
    </span>
  );
}
