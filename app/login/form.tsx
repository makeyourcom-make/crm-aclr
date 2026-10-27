"use client";

import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useActionState, useState } from "react";

import { FIELD_CLASS, HINT_CLASS, LABEL_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = { ok: false };

/**
 * Formulaire de connexion. Logique inchangée : Server Action
 * `loginAction` via useActionState, mêmes champs (email, password, totp).
 * Ajout purement visuel : bouton œil pour afficher le mot de passe.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Email */}
      <div>
        <label htmlFor="email" className={LABEL_CLASS}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          aria-invalid={state.fieldErrors?.email ? "true" : undefined}
          aria-describedby={
            state.fieldErrors?.email ? "email-error" : undefined
          }
          className={FIELD_CLASS}
          placeholder="arthur@makeyourcom.ch"
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="mt-1.5 text-xs font-bold text-alert-700">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      {/* Mot de passe */}
      <div>
        <label htmlFor="password" className={LABEL_CLASS}>
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={state.fieldErrors?.password ? "true" : undefined}
            aria-describedby={
              state.fieldErrors?.password ? "password-error" : undefined
            }
            className={cn(FIELD_CLASS, "pr-12")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={
              showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
            }
            aria-pressed={showPassword}
            className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-[18px]" />
            ) : (
              <Eye aria-hidden="true" className="size-[18px]" />
            )}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p
            id="password-error"
            className="mt-1.5 text-xs font-bold text-alert-700"
          >
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      {/* Code 2FA (optionnel : uniquement si la double authentification est activée) */}
      <div>
        <label htmlFor="totp" className={LABEL_CLASS}>
          Code 2FA{" "}
          <span className="font-semibold text-muted-foreground">(si activée)</span>
        </label>
        <input
          id="totp"
          name="totp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          aria-describedby="totp-hint"
          className={cn(FIELD_CLASS, "tracking-[0.2em] tabular-nums")}
        />
        <p id="totp-hint" className={HINT_CLASS}>
          Laisse vide si tu n&apos;as pas activé la 2FA. Code de l&apos;app
          d&apos;authentification ou code de secours.
        </p>
      </div>

      {/* Erreur globale */}
      {state.error && !state.fieldErrors && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[14px] bg-alert-50 px-3.5 py-3 text-[13px] font-semibold text-alert-700"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Bouton : le CTA héros de l'écran */}
      <Button
        type="submit"
        variant="hero"
        size="xl"
        disabled={pending}
        className="w-full"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <LogIn aria-hidden="true" />
        )}
        {pending ? "Connexion en cours…" : "Se connecter"}
      </Button>

      <p className="text-center text-xs font-medium text-muted-foreground">
        Mot de passe oublié ? Demande à Arthur de le réinitialiser.
      </p>
    </form>
  );
}
