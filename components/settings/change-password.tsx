"use client";

/**
 * Bloc « Mot de passe » de la page Sécurité : changement du mot de passe de
 * l'utilisateur connecté (ancien + nouveau + confirmation).
 */
import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { changePassword } from "@/app/(app)/settings/securite/actions";
import { SectionCard } from "@/components/arena/section-card";
import { FIELD_CLASS, HINT_CLASS, LABEL_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
      toast.success("Mot de passe mis à jour.");
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  };

  return (
    <SectionCard
      className="mb-6"
      title="Mot de passe"
      description="Change ton mot de passe de connexion"
      icon={KeyRound}
      tone="navy"
    >
      <form onSubmit={submit} className="space-y-4">
        <PwdField
          id="cur-pwd"
          label="Mot de passe actuel"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          show={show}
          onToggle={() => setShow((v) => !v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
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
        <p className={HINT_CLASS}>
          Au moins 8 caractères. Utilise un mot de passe unique, différent de
          tes autres comptes.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={pending || !current || !next || !confirm}
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {pending ? "Mise à jour…" : "Changer le mot de passe"}
        </Button>
      </form>
    </SectionCard>
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
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className={cn(FIELD_CLASS, "pr-12")}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? "Masquer les mots de passe" : "Afficher les mots de passe"}
          aria-pressed={show}
          title={show ? "Masquer" : "Afficher"}
          className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground"
        >
          {show ? (
            <EyeOff aria-hidden="true" className="size-[18px]" />
          ) : (
            <Eye aria-hidden="true" className="size-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
}
