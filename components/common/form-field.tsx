/**
 * Champ de formulaire MYC Arena : libellé visible associé au contrôle
 * (le contrôle est placé DANS le <label>, association implicite, pas besoin
 * d'id), aide optionnelle dessous.
 *
 *   <FormField label="Fournisseur" hint="Migros, Google…" required>
 *     <Input className={FIELD_CLASS} … />
 *   </FormField>
 *
 * Server-safe (aucun hook) : utilisable dans un composant client ou serveur.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { HINT_CLASS, LABEL_CLASS } from "./form-styles";

export interface FormFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  /** Le contrôle (input, select, textarea) : contenu phrasé uniquement. */
  children: ReactNode;
}

export function FormField({
  label,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="block">
        <span className={LABEL_CLASS}>
          {label}
          {required && (
            <>
              <span aria-hidden="true" className="ml-0.5 text-coral-600">
                *
              </span>
              <span className="sr-only"> (obligatoire)</span>
            </>
          )}
        </span>
        {children}
      </label>
      {hint && <p className={HINT_CLASS}>{hint}</p>}
    </div>
  );
}
