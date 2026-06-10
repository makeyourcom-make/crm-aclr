"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createSignature,
  deleteSignature,
  setDefaultSignature,
  updateSignature,
} from "@/app/(app)/parametres/signature-actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const remove = (s: SignatureItem) =>
    startTransition(async () => {
      const res = await deleteSignature(s.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Signature supprimée.");
      router.refresh();
    });

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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {signatures.length} signature(s). La signature par défaut est
          pré-sélectionnée à l&apos;envoi d&apos;un email.
        </p>
        <Button type="button" onClick={openNew}>
          <Icon name="Plus" className="mr-1 h-4 w-4" />
          Nouvelle signature
        </Button>
      </div>

      {signatures.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Aucune signature pour l&apos;instant. Crée ta première signature
          personnalisée.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {signatures.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-semibold">{s.nom}</span>
                {s.isDefault && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Par défaut
                  </span>
                )}
              </div>
              <div
                className="rounded border border-border bg-white p-3"
                dangerouslySetInnerHTML={{ __html: s.html }}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(s)}
                >
                  <Icon name="Pencil" className="mr-1 h-3.5 w-3.5" />
                  Modifier
                </Button>
                {!s.isDefault && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => makeDefault(s)}
                    disabled={pending}
                  >
                    Définir par défaut
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => remove(s)}
                  disabled={pending}
                  className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Icon name="Trash2" className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire création / édition */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Modifier la signature" : "Nouvelle signature"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Champs guidés */}
            <div className="space-y-3">
              <Field label="Nom de la signature *">
                <Input
                  value={form.nom}
                  onChange={(e) => set("nom", e.target.value)}
                  placeholder="Ex. Pro, Court, Promo…"
                />
              </Field>
              <Field label="Nom affiché *">
                <Input
                  value={form.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  placeholder="Arthur Chazelle"
                />
              </Field>
              <Field label="Fonction">
                <Input
                  value={form.fonction}
                  onChange={(e) => set("fonction", e.target.value)}
                  placeholder="Directeur"
                />
              </Field>
              <Field label="Entreprise">
                <Input
                  value={form.entreprise}
                  onChange={(e) => set("entreprise", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Téléphone">
                  <Input
                    value={form.telephone}
                    onChange={(e) => set("telephone", e.target.value)}
                    placeholder="+41 …"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Site web">
                <Input
                  value={form.siteWeb}
                  onChange={(e) => set("siteWeb", e.target.value)}
                  placeholder="makeyourcom.ch"
                />
              </Field>
              <Field label="Logo (URL image, optionnel)">
                <Input
                  value={form.logoUrl}
                  onChange={(e) => set("logoUrl", e.target.value)}
                  placeholder="https://…/logo.png"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => set("isDefault", e.target.checked)}
                />
                Définir comme signature par défaut
              </label>
            </div>

            {/* Aperçu en direct */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Aperçu
              </p>
              <div
                className="rounded-md border border-border bg-white p-4"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
