"use client";

/**
 * Bloc « Mot de passe » de la page Sécurité : changement du mot de passe de
 * l'utilisateur connecté (ancien + nouveau + confirmation).
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { changePassword } from "@/app/(app)/settings/securite/actions";
import { Icon } from "@/components/icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Le nouveau mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (next !== confirm) {
      toast.error("La confirmation ne correspond pas.");
      return;
    }
    startTransition(async () => {
      const res = await changePassword({
        currentPassword: current,
        newPassword: next,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec du changement de mot de passe.");
        return;
      }
      toast.success("Mot de passe mis à jour ✓");
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon name="Lock" className="h-4 w-4" />
          Mot de passe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <PwdField
            id="cur-pwd"
            label="Mot de passe actuel"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            show={show}
            onToggle={() => setShow((v) => !v)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <PwdField
              id="new-pwd"
              label="Nouveau mot de passe"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
              show={show}
              onToggle={() => setShow((v) => !v)}
            />
            <PwdField
              id="cfm-pwd"
              label="Confirmer"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              show={show}
              onToggle={() => setShow((v) => !v)}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Au moins 8 caractères. Utilise un mot de passe unique, différent de
            tes autres comptes.
          </p>
          <button
            type="submit"
            disabled={pending || !current || !next || !confirm}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Icon name={pending ? "Loader" : "Check"} className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
            {pending ? "Mise à jour…" : "Changer le mot de passe"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Champ mot de passe avec bouton œil pour afficher/masquer la saisie. */
function PwdField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  show,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="pr-9"
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? "Masquer" : "Afficher"}
          title={show ? "Masquer" : "Afficher"}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <Icon name={show ? "EyeOff" : "Eye"} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
