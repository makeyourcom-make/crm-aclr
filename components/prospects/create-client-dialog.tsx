"use client";

/**
 * Dialog de création rapide d'un client « propre » depuis le wizard de
 * contrat (ou ailleurs). Capture les champs nécessaires à un contrat valide :
 * raison sociale, contact, adresse, NPA/ville, pays, N° IDE (CHE) et TVA.
 * À la création, renvoie le prospect créé au parent (qui le sélectionne).
 */
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProspectQuick } from "@/app/(app)/prospects/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CreatedClient {
  id: string;
  raisonSociale: string;
  ville: string | null;
}

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nom pré-rempli (texte tapé dans la recherche). */
  defaultName?: string;
  onCreated: (client: CreatedClient) => void;
}

export function CreateClientDialog({
  open,
  onOpenChange,
  defaultName = "",
  onCreated,
}: CreateClientDialogProps) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    raisonSociale: defaultName,
    contactPrenom: "",
    contactNom: "",
    email: "",
    telephone: "",
    adresse: "",
    codePostal: "",
    ville: "",
    pays: "Suisse",
    numeroIDE: "",
    numeroTVA: "",
  });

  // Resynchronise le nom quand on rouvre avec un autre texte tapé.
  const [lastDefault, setLastDefault] = useState(defaultName);
  if (defaultName !== lastDefault) {
    setLastDefault(defaultName);
    setForm((f) => ({ ...f, raisonSociale: defaultName }));
  }

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (form.raisonSociale.trim().length < 2) {
      toast.error("La raison sociale est obligatoire.");
      return;
    }
    startTransition(async () => {
      const res = await createProspectQuick({
        raisonSociale: form.raisonSociale.trim(),
        contactPrenom: form.contactPrenom.trim() || undefined,
        contactNom: form.contactNom.trim() || undefined,
        email: form.email.trim() || undefined,
        telephone: form.telephone.trim() || undefined,
        adresse: form.adresse.trim() || undefined,
        codePostal: form.codePostal.trim() || undefined,
        ville: form.ville.trim() || undefined,
        pays: form.pays.trim() || "Suisse",
        numeroIDE: form.numeroIDE.trim() || undefined,
        numeroTVA: form.numeroTVA.trim() || undefined,
      });
      if (!res.ok || !res.prospectId) {
        toast.error(res.error ?? "Échec de la création du client.");
        return;
      }
      toast.success(`Client « ${form.raisonSociale.trim()} » créé ✓`);
      onCreated({
        id: res.prospectId,
        raisonSociale: form.raisonSociale.trim(),
        ville: form.ville.trim() || null,
      });
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
          <DialogDescription>
            Renseigne la fiche pour que le contrat soit valide (adresse, N° IDE…).
            Tu pourras la compléter plus tard depuis Entreprises.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-1 pr-1">
          <Field label="Raison sociale *">
            <Input
              autoFocus
              value={form.raisonSociale}
              onChange={(e) => set("raisonSociale", e.target.value)}
              placeholder="Ex. Boulangerie Bretteau Sàrl"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom contact">
              <Input
                value={form.contactPrenom}
                onChange={(e) => set("contactPrenom", e.target.value)}
              />
            </Field>
            <Field label="Nom contact">
              <Input
                value={form.contactNom}
                onChange={(e) => set("contactNom", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Téléphone">
              <Input
                value={form.telephone}
                onChange={(e) => set("telephone", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Adresse">
            <Input
              value={form.adresse}
              onChange={(e) => set("adresse", e.target.value)}
              placeholder="Rue et numéro"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="NPA / Code postal">
              <Input
                value={form.codePostal}
                onChange={(e) => set("codePostal", e.target.value)}
              />
            </Field>
            <Field label="Ville">
              <Input
                value={form.ville}
                onChange={(e) => set("ville", e.target.value)}
              />
            </Field>
            <Field label="Pays">
              <Input
                value={form.pays}
                onChange={(e) => set("pays", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="N° IDE (CHE-…)">
              <Input
                value={form.numeroIDE}
                onChange={(e) => set("numeroIDE", e.target.value)}
                placeholder="CHE-123.456.789"
              />
            </Field>
            <Field label="N° TVA">
              <Input
                value={form.numeroTVA}
                onChange={(e) => set("numeroTVA", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? "Création…" : "Créer le client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
