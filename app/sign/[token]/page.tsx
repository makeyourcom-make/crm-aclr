/**
 * Page PUBLIQUE de signature client — pas d'auth requise.
 *
 * Route exclue par le proxy (.matcher inclut /sign).
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SignForm } from "./form";
import { Logo } from "@/components/brand/logo";
import { prisma } from "@/lib/db";
import { formatCHF, formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SignPage({ params }: PageProps) {
  const { token } = await params;
  const sig = await prisma.signature.findUnique({
    where: { lienSignature: token },
    include: {
      contract: {
        include: {
          prospect: {
            select: {
              raisonSociale: true,
              contactPrenom: true,
              contactNom: true,
            },
          },
          products: { select: { nom: true } },
        },
      },
    },
  });
  if (!sig) notFound();

  const hdrs = await headers();
  const ipClient =
    hdrs.get("x-forwarded-for")?.split(",")[0] ??
    hdrs.get("x-real-ip") ??
    undefined;

  const now = new Date();
  const isExpired = sig.expireA < now;
  const alreadySigned = sig.signeParClient;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Logo variant="mark" size={48} className="rounded-md shadow-sm" />
          <div>
            <p className="text-lg font-semibold text-slate-900">
              Make Your Com
            </p>
            <p className="text-xs text-slate-500">ACLR Sàrl</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            Proposition de contrat
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            N° {sig.contract.numero} — {sig.contract.prospect.raisonSociale}
          </p>

          {/* Récap */}
          <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
            <h2 className="text-sm font-semibold text-foreground">Récapitulatif</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Client" value={sig.contract.prospect.raisonSociale} />
              <Row
                label="Date de début"
                value={formatDateLong(sig.contract.dateDebut)}
              />
              <Row
                label="Durée"
                value={`${sig.contract.dureeMois} mois`}
              />
              <Row
                label="Montant one-shot"
                value={formatCHF(Number(sig.contract.montantOneShot))}
              />
              <Row
                label="Mensuel"
                value={`${formatCHF(Number(sig.contract.montantMensuel))} / mois`}
              />
              <Row
                label="Valeur an 1"
                value={formatCHF(Number(sig.contract.valeurAn1))}
                big
              />
            </dl>
            {sig.contract.products.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Produits & services
                </p>
                <ul className="mt-1 text-sm">
                  {sig.contract.products.map((p, i) => (
                    <li key={i}>• {p.nom}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* CGV minimum */}
          <details className="mt-6 rounded-md border border-border bg-card p-3 text-xs">
            <summary className="cursor-pointer font-medium">
              Conditions générales (extrait)
            </summary>
            <p className="mt-2 text-muted-foreground">
              Contrat de prestations digitales avec ACLR Sàrl. Engagement
              {" "}{sig.contract.dureeMois} mois renouvelable tacitement.
              Résiliation possible avec préavis 30 jours. Tarifs ajustables
              à chaque renouvellement annuel.
            </p>
          </details>

          {/* État de la signature */}
          <div className="mt-6">
            {isExpired ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                ⚠ Ce lien de signature a expiré le{" "}
                {formatDateLong(sig.expireA)}. Contacte ton interlocuteur
                pour obtenir un nouveau lien.
              </div>
            ) : alreadySigned ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="font-medium text-emerald-900">
                  ✓ Contrat signé
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  Signé le{" "}
                  {sig.dateSignatureClient
                    ? formatDateLong(sig.dateSignatureClient)
                    : "—"}
                  {sig.signeParAclr ? " et contre-signé par ACLR." : "."}
                </p>
              </div>
            ) : (
              <SignForm token={token} ipClient={ipClient} />
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Lien sécurisé · Expire {formatDateLong(sig.expireA)}
        </p>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-slate-600">{label}</dt>
      <dd
        className={`tabular-nums font-medium ${big ? "text-lg text-primary" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
