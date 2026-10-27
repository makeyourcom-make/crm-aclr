"use client";

import { Loader2, Save, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateMyProfile } from "@/app/(app)/parametres/actions";
import { SectionCard } from "@/components/arena/section-card";
import { FormField } from "@/components/common/form-field";
import { FIELD_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProfileFormProps {
  user: {
    name: string;
    email: string;
    iban: string | null;
    telephone: string | null;
    adresse: string | null;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState({
    name: user.name,
    iban: user.iban ?? "",
    telephone: user.telephone ?? "",
    adresse: user.adresse ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateMyProfile(state);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Profil mis à jour.");
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <SectionCard
        title="Mon profil"
        description="Tes coordonnées personnelles"
        icon={UserRound}
        tone="navy"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Email"
            hint="L'email est immuable. Demande à l'admin pour le changer."
          >
            <Input value={user.email} disabled className={FIELD_CLASS} />
          </FormField>
          <FormField label="Nom complet" required>
            <Input
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
              required
              autoComplete="name"
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Adresse" className="sm:col-span-2">
            <Input
              value={state.adresse}
              onChange={(e) =>
                setState({ ...state, adresse: e.target.value })
              }
              autoComplete="street-address"
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Téléphone">
            <Input
              value={state.telephone}
              onChange={(e) =>
                setState({ ...state, telephone: e.target.value })
              }
              placeholder="+41 79 000 00 00"
              type="tel"
              autoComplete="tel"
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="IBAN" hint="Apparaît sur tes factures mensuelles PDF.">
            <Input
              value={state.iban}
              onChange={(e) => setState({ ...state, iban: e.target.value })}
              placeholder="CH00 0000 0000 0000 0000 0"
              className={`${FIELD_CLASS} font-mono`}
            />
          </FormField>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {pending ? "Enregistrement…" : "Enregistrer mon profil"}
          </Button>
        </div>
      </SectionCard>
    </form>
  );
}
