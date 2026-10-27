"use client";

import { Loader2, PenLine, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createSignature,
  deleteSignature,
  setDefaultSignature,
  updateSignature,
} from "@/app/(app)/parametres/signature-actions";
import { EmptyState } from "@/components/arena/empty-state";
import { StatusPill } from "@/components/arena/pills";
import { FormField } from "@/components/common/form-field";
import { CHECKBOX_CLASS, FIELD_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildSignatureHtml } from "@/lib/email-signature";

export interface SignatureItem {
  id: string;
  nom: string;
  displayName: string;
  fonction: string | null;
  telephone: string | null;
  email: string | null;
  siteWeb: string | null;
  entreprise: string | null;
  logoUrl: string | null;
  html: string;
  isDefault: boolean;
}

interface FormState {
  nom: string;
  displayName: string;
  fonction: string;
  telephone: string;
  email: string;
  siteWeb: string;
  entreprise: string;
  logoUrl: string;
  isDefault: boolean;
}

const EMPTY: FormState = {
  nom: "",
  displayName: "",
  fonction: "",
  telephone: "",
  email: "",
  siteWeb: "",
  entreprise: "Make Your Com",
  logoUrl: "",
  isDefault: false,
};

export function SignaturesManager({
  signatures,
  defaults,
}: {
  signatures: SignatureItem[];
  /** Pré-remplissage d'une nouvelle signature depuis le profil. */
  defaults: { displayName: string; email: string; telephone: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const previewHtml = useMemo(
    () =>
      buildSignatureHtml({
        displayName: form.displayName || "Votre nom",
        fonction: form.fonction,
        telephone: form.telephone,
        email: form.email,
        siteWeb: form.siteWeb,
        entreprise: form.entreprise,
        logoUrl: form.logoUrl,
      }),
    [form],
  );

  const openNew = () => {
    setEditId(null);
    setForm({
      ...EMPTY,
      displayName: defaults.displayName,
      email: defaults.email,
      telephone: defaults.telephone,
      isDefault: signatures.length === 0,
    });
    setOpen(true);
  };

  const openEdit = (s: SignatureItem) => {
    setEditId(s.id);
    setForm({
      nom: s.nom,
      displayName: s.displayName,
      fonction: s.fonction ?? "",
      telephone: s.telephone ?? "",
      email: s.email ?? "",
      siteWeb: s.siteWeb ?? "",
      entreprise: s.entreprise ?? "",
      logoUrl: s.logoUrl ?? "",
      isDefault: s.isDefault,
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.nom.trim() || !form.displayName.trim()) {
      toast.error("Le nom de la signature et le nom affiché sont requis.");
      return;
    }
    startTransition(async () => {
      const res = editId
        ? await updateSignature(editId, form)
        : await createSignature(form);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(editId ? "Signature mise à jour." : "Signature créée.");
      setOpen(false);
      router.refresh();
    });
  };

  const remove = (s: SignatureItem) => {
    if (!confirm(`Supprimer la signature « ${s.nom} » ?`)) return;
    startTransition(async () => {
      const res = await deleteSignature(s.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Signature supprimée.");
      router.refresh();
    });
  };

  const makeDefault = (s: SignatureItem) =>
    startTransition(async () => {
      const res = await setDefaultSignature(s.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(`« ${s.nom} » est la signature par défaut.`);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {signatures.length} signature(s). La signature par défaut est
          pré-sélectionnée à l&apos;envoi d&apos;un email.
        </p>
        <Button type="button" size="lg" onClick={openNew}>
          <Plus aria-hidden="true" />
          Nouvelle signature
        </Button>
      </div>

      {signatures.length === 0 ? (
        <EmptyState
          icon={PenLine}
          tone="teal"
          title="Aucune signature pour l'instant"
          description="Crée ta première signature personnalisée : elle sera ajoutée à tes emails."
          action={
            <Button type="button" size="lg" onClick={openNew}>
              <Plus aria-hidden="true" />
              Créer ma signature
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {signatures.map((s) => (
            <li
              key={s.id}
              className="flex min-w-0 flex-col rounded-[20px] border border-border bg-card p-4 shadow-arena"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate font-display text-base font-extrabold">
                  {s.nom}
                </span>
                {s.isDefault && (
                  <StatusPill tone="green" icon={Star}>
                    Par défaut
                  </StatusPill>
                )}
              </div>
              <div
                className="overflow-x-auto rounded-[12px] border border-border bg-white p-3"
                dangerouslySetInnerHTML={{ __html: s.html }}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openEdit(s)}
                >
                  <Pencil aria-hidden="true" />
                  Modifier
                </Button>
                {!s.isDefault && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => makeDefault(s)}
                    disabled={pending}
                  >
                    <Star aria-hidden="true" />
                    Définir par défaut
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => remove(s)}
                  disabled={pending}
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-xs font-bold text-alert-700 transition-colors hover:bg-alert-50 disabled:opacity-50"
                  aria-label={`Supprimer la signature ${s.nom}`}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Formulaire création / édition */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Modifier la signature" : "Nouvelle signature"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Champs guidés */}
            <div className="space-y-3">
              <FormField label="Nom de la signature" required>
                <Input
                  value={form.nom}
                  onChange={(e) => set("nom", e.target.value)}
                  placeholder="Ex. Pro, Court, Promo…"
                  className={FIELD_CLASS}
                />
              </FormField>
              <FormField label="Nom affiché" required>
                <Input
                  value={form.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  placeholder="Arthur Chazelle"
                  className={FIELD_CLASS}
                />
              </FormField>
              <FormField label="Fonction">
                <Input
                  value={form.fonction}
                  onChange={(e) => set("fonction", e.target.value)}
                  placeholder="Directeur"
                  className={FIELD_CLASS}
                />
              </FormField>
              <FormField label="Entreprise">
                <Input
                  value={form.entreprise}
                  onChange={(e) => set("entreprise", e.target.value)}
                  className={FIELD_CLASS}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <FormField label="Téléphone">
                  <Input
                    value={form.telephone}
                    onChange={(e) => set("telephone", e.target.value)}
                    placeholder="+41 …"
                    type="tel"
                    className={FIELD_CLASS}
                  />
                </FormField>
                <FormField label="Email">
                  <Input
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    type="email"
                    className={FIELD_CLASS}
                  />
                </FormField>
              </div>
              <FormField label="Site web">
                <Input
                  value={form.siteWeb}
                  onChange={(e) => set("siteWeb", e.target.value)}
                  placeholder="makeyourcom.ch"
                  className={FIELD_CLASS}
                />
              </FormField>
              <FormField label="Logo (URL image, optionnel)">
                <Input
                  value={form.logoUrl}
                  onChange={(e) => set("logoUrl", e.target.value)}
                  placeholder="https://…/logo.png"
                  className={FIELD_CLASS}
                />
              </FormField>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => set("isDefault", e.target.checked)}
                  className={CHECKBOX_CLASS}
                />
                Définir comme signature par défaut
              </label>
            </div>

            {/* Aperçu en direct */}
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Aperçu
              </p>
              <div
                className="overflow-x-auto rounded-[14px] border border-border bg-white p-4"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="button" size="lg" onClick={submit} disabled={pending}>
              {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
