import type { Metadata } from "next";

import { LoginForm } from "./form";

export const metadata: Metadata = {
  title: "Connexion",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4">
      <div className="w-full max-w-md">
        {/* En-tête de marque */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div
            className="h-12 w-12 rounded-md shadow-sm"
            style={{ backgroundColor: "#1F4E78" }}
            aria-hidden
          />
          <div>
            <p className="text-lg font-semibold tracking-tight text-slate-900">
              Make Your Com
            </p>
            <p className="text-xs text-slate-500">CRM — ACLR Sàrl</p>
          </div>
        </div>

        {/* Carte de login */}
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Connexion</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bienvenue, entre tes identifiants pour accéder au CRM.
          </p>

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        {/* Pied */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Application interne — accès réservé.
        </p>
      </div>
    </main>
  );
}
