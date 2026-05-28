"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateMyProfile } from "@/app/(app)/parametres/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mon profil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user.email} disabled />
            <p className="text-[11px] text-muted-foreground">
              L&apos;email est immuable. Demande à l&apos;admin pour le
              changer.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Nom complet</Label>
            <Input
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Adresse</Label>
            <Input
              value={state.adresse}
              onChange={(e) =>
                setState({ ...state, adresse: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Téléphone</Label>
            <Input
              value={state.telephone}
              onChange={(e) =>
                setState({ ...state, telephone: e.target.value })
              }
              placeholder="+41 79 000 00 00"
            />
          </div>
          <div className="space-y-1.5">
            <Label>IBAN</Label>
            <Input
              value={state.iban}
              onChange={(e) => setState({ ...state, iban: e.target.value })}
              placeholder="CH00 0000 0000 0000 0000 0"
            />
            <p className="text-[11px] text-muted-foreground">
              Apparaît sur tes factures mensuelles PDF.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer mon profil"}
        </Button>
      </div>
    </form>
  );
}
