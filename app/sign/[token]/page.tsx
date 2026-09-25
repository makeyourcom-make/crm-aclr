/**
 * Page PUBLIQUE de signature client — pas d'auth requise.
 *
 * Route exclue par le proxy (.matcher inclut /sign).
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SignForm } from "./form";
import { Logo } from "@/components/brand/logo";
import { CGV_ARTICLES, CGV_TITLE, CGV_VERSION } from "@/lib/cgv";
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
          products: {
            select: {
              id: true,
              nom: true,
              description: true,
              prixOneShot: true,
              prixMensuel: true,
            },
          },
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

  // ── Détail des prestations (mêmes règles que le PDF : offert / remise par
  // ligne via contract.lignesMeta ; frais unique compté à la quantité, mensuel
  // compté sur la durée du contrat). ────────────────────────────────────────
  type Cible = "ONESHOT" | "RECURRENT" | "DEUX" | null;
  type LigneMeta = {
    productId: string;
    quantite?: number | null;
    prixOneShotOriginal?: number | null;
    prixMensuelOriginal?: number | null;
    offert?: boolean;
    offertCible?: Cible;
    remiseType?: "POURCENT" | "MONTANT" | null;
    remiseValeur?: number | null;
    remiseCible?: Cible;
  };
  const metaArr: LigneMeta[] = Array.isArray(sig.contract.lignesMeta)
    ? (sig.contract.lignesMeta as unknown as LigneMeta[])
    : [];
  const metaByProduct = new Map(metaArr.map((m) => [m.productId, m]));

  const effectivePart = (
    base: number,
    part: "ONESHOT" | "RECURRENT",
    m?: LigneMeta,
  ): number => {
    if (!m) return base;
    if (m.offert) {
      const c = m.offertCible ?? "DEUX";
      if (part === "ONESHOT" && c !== "RECURRENT") return 0;
      if (part === "RECURRENT" && c !== "ONESHOT") return 0;
      return base;
    }
    const r = m.remiseValeur ?? 0;
    if (m.remiseType && r > 0) {
      const c = m.remiseCible ?? "DEUX";
      const applies =
        (part === "ONESHOT" && c !== "RECURRENT") ||
        (part === "RECURRENT" && c !== "ONESHOT");
      if (!applies) return base;
      if (m.remiseType === "POURCENT") return base * Math.max(0, 1 - r / 100);
      return Math.max(0, base - r);
    }
    return base;
  };

  const prestations = sig.contract.products.map((p) => {
    const meta = metaByProduct.get(p.id);
    const qte = meta?.quantite ?? 1;
    const baseOne = meta?.prixOneShotOriginal ?? Number(p.prixOneShot ?? 0);
    const baseMens = meta?.prixMensuelOriginal ?? Number(p.prixMensuel ?? 0);
    const remiseLabel =
      meta?.remiseType === "POURCENT" && meta?.remiseValeur
        ? `−${meta.remiseValeur}%`
        : meta?.remiseType === "MONTANT" && meta?.remiseValeur
          ? `−${formatCHF(meta.remiseValeur)}`
          : null;
    const desc = (p.description ?? "").trim();

    const lines: Array<{
      label: string;
      qte: number;
      suffix: string;
      origTotal: number;
      effTotal: number;
      badge: string | null;
    }> = [];
    if (baseOne > 0) {
      const eff = effectivePart(baseOne, "ONESHOT", meta);
      lines.push({
        label: "Frais unique",
        qte,
        suffix: "",
        origTotal: baseOne * qte,
        effTotal: eff * qte,
        badge: eff === 0 ? "OFFERT" : eff < baseOne ? remiseLabel : null,
      });
    }
    if (baseMens > 0) {
      const eff = effectivePart(baseMens, "RECURRENT", meta);
      lines.push({
        label: "Abonnement mensuel",
        qte,
        suffix: " / mois",
        origTotal: baseMens,
        effTotal: eff,
        badge: eff === 0 ? "OFFERT" : eff < baseMens ? remiseLabel : null,
      });
    }
    return {
      nom: p.nom,
      description: desc.startsWith("[Custom]") ? "" : desc,
      lines,
    };
  });

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
          </div>

          {/* Détail des prestations (comme le bon de commande PDF) */}
          {prestations.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-foreground">
                Détail des prestations
              </h2>
              <div className="mt-3 divide-y divide-border rounded-lg border border-border">
                {prestations.map((p, i) => (
                  <div key={i} className="p-3">
                    <p className="font-medium text-foreground">{p.nom}</p>
                    {p.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                    <div className="mt-2 space-y-1">
                      {p.lines.map((l, j) => (
                        <div
                          key={j}
                          className="flex items-baseline justify-between gap-2 text-sm"
                        >
                          <span className="text-slate-600">
                            {l.label}
                            {l.qte > 1 ? (
                              <span className="text-muted-foreground">
                                {" "}
                                × {l.qte}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex items-baseline gap-1.5 tabular-nums">
                            {l.badge && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  l.badge === "OFFERT"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {l.badge}
                              </span>
                            )}
                            {l.origTotal !== l.effTotal && (
                              <span className="text-xs text-muted-foreground line-through">
                                {formatCHF(l.origTotal)}
                              </span>
                            )}
                            <span className="font-medium">
                              {formatCHF(l.effTotal)}
                              {l.suffix}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CGV intégrales — repliable pour ne pas écraser l'écran tablette */}
          <details className="mt-6 rounded-md border border-border bg-card p-3 text-xs">
            <summary className="cursor-pointer font-medium">
              📄 {CGV_TITLE} (version {CGV_VERSION})
            </summary>
            <div className="mt-3 max-h-[420px] space-y-4 overflow-y-auto pr-2 text-muted-foreground">
              <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
                ⚠ Lis attentivement ces CGV : en signant, tu confirmes les
                avoir acceptées sans réserve. Elles sont également annexées
                au PDF du contrat que tu recevras.
              </p>
              {CGV_ARTICLES.map((article) => (
                <div key={article.number}>
                  <p className="font-semibold text-foreground">
                    {article.number}. {article.title}
                  </p>
                  <div className="mt-1 space-y-1.5">
                    {article.paragraphs.map((p) => (
                      <p key={p.id}>
                        <strong className="text-foreground">{p.id}</strong>{" "}
                        {p.text}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Tu peux aussi{" "}
              <a
                href={`/api/contrats/${sig.contract.id}/pdf?token=${token}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                télécharger le projet de contrat complet (PDF)
              </a>
              .
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
                {/* Retour au CRM — pratique après une signature en direct
                    (tablette). Le client non connecté sera renvoyé au login. */}
                <a
                  href={`/contrats/${sig.contract.id}`}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  ← Retour au CRM
                </a>
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
