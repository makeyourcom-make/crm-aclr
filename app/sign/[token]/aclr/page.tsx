/**
 * Page PUBLIQUE de signature du VENDEUR (commercial·e ou admin) — via QR code.
 * Pas d'auth : la personne scanne le QR et signe au doigt sur son téléphone.
 * Route sous /sign → exclue du proxy d'authentification.
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { prisma } from "@/lib/db";
import { formatCHF, formatDateLong } from "@/lib/format";

import { AclrSignForm } from "./form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AclrSignPage({ params }: PageProps) {
  const { token } = await params;
  const sig = await prisma.signature.findUnique({
    where: { lienSignature: token },
    include: {
      contract: {
        select: {
          id: true,
          numero: true,
          valeurAn1: true,
          prospect: { select: { raisonSociale: true } },
          assigneA: { select: { name: true } },
        },
      },
    },
  });
  if (!sig) notFound();

  const hdrs = await headers();
  const ipAclr =
    hdrs.get("x-forwarded-for")?.split(",")[0] ??
    hdrs.get("x-real-ip") ??
    undefined;

  const isExpired = sig.expireA < new Date();
  const already = sig.signeParAclr;
  const commercialName = sig.contract.assigneA?.name ?? "Commercial ACLR";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Logo variant="mark" size={44} className="rounded-md shadow-sm" />
          <div>
            <p className="text-base font-semibold text-slate-900">Make Your Com</p>
            <p className="text-xs text-slate-500">Signature du commercial</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">
            Signature du contrat
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            N° {sig.contract.numero} — {sig.contract.prospect.raisonSociale}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Commercial :{" "}
              <strong className="text-slate-700">{commercialName}</strong>
            </span>
            <span>
              Valeur an 1 :{" "}
              <strong className="text-slate-700">
                {formatCHF(Number(sig.contract.valeurAn1))}
              </strong>
            </span>
            <span>
              Client :{" "}
              {sig.signeParClient ? (
                <strong className="text-emerald-700">a signé ✓</strong>
              ) : (
                <strong className="text-amber-700">pas encore signé</strong>
              )}
            </span>
          </div>

          <div className="mt-6">
            {isExpired ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                ⚠ Ce lien a expiré le {formatDateLong(sig.expireA)}.
              </div>
            ) : already ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="font-medium text-emerald-900">
                  ✓ Déjà signé par le commercial
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  Le{" "}
                  {sig.dateSignatureAclr
                    ? formatDateLong(sig.dateSignatureAclr)
                    : "—"}
                  . L&apos;admin validera le contrat pour l&apos;activer.
                </p>
                <a
                  href={`/contrats/${sig.contract.id}`}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  ← Retour au CRM
                </a>
              </div>
            ) : (
              <AclrSignForm
                token={token}
                commercialName={commercialName}
                ipAclr={ipAclr}
                contractId={sig.contract.id}
              />
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
