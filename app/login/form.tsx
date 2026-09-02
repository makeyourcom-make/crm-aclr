"use client";

import { useActionState } from "react";

import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = { ok: false };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {/* Email */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium text-slate-700"
        >
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
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 aria-[invalid=true]:border-red-500"
          placeholder="arthur@makeyourcom.ch"
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="text-xs text-red-600">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      {/* Mot de passe */}
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="text-sm font-medium text-slate-700"
        >
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.password ? "true" : undefined}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 aria-[invalid=true]:border-red-500"
        />
        {state.fieldErrors?.password && (
          <p id="password-error" className="text-xs text-red-600">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      {/* Code 2FA (optionnel — uniquement si la double authentification est activée) */}
      <div className="space-y-1.5">
        <label htmlFor="totp" className="text-sm font-medium text-slate-700">
          Code 2FA <span className="font-normal text-slate-400">(si activée)</span>
        </label>
        <input
          id="totp"
          name="totp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20"
        />
        <p className="text-xs text-slate-400">
          Laisse vide si tu n&apos;as pas activé la 2FA. Code de l&apos;app
          d&apos;authentification ou code de secours.
        </p>
      </div>

      {/* Erreur globale */}
      {state.error && !state.fieldErrors && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Bouton */}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Connexion en cours…" : "Se connecter"}
      </button>

      <p className="pt-1 text-center text-xs text-slate-400">
        Mot de passe oublié ? Demande à Arthur de le réinitialiser.
      </p>
    </form>
  );
}
