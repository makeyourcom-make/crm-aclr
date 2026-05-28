import Link from "next/link";

import { SignAclrButton } from "@/components/signatures/sign-aclr-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Signatures" };
export const dynamic = "force-dynamic";

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée — en attente client",
  SIGNEE_CLIENT: "Signée client",
  SIGNEE_ACLR: "Signée ACLR",
  COMPLETEE: "Complétée",
  REFUSEE: "Refusée",
  EXPIREE: "Expirée",
};
const STATUT_BADGE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600",
  ENVOYEE: "bg-blue-100 text-blue-700",
  SIGNEE_CLIENT: "bg-amber-100 text-amber-700",
  SIGNEE_ACLR: "bg-amber-100 text-amber-700",
  COMPLETEE: "bg-emerald-100 text-emerald-700",
  REFUSEE: "bg-red-100 text-red-700",
  EXPIREE: "bg-slate-100 text-slate-400",
};

export default async function SignaturesPage() {
  const user = await requireUser();

  const signatures = await prisma.signature.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : { contract: { assigneAId: user.id } },
    include: {
      contract: {
        select: {
          id: true,
          numero: true,
          assigneAId: true,
          prospect: { select: { raisonSociale: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Signatures électroniques"
        description="Demandes de signature envoyées aux clients. Liens uniques sécurisés, expiration 14 jours."
      />

      {signatures.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucune demande de signature. Lance-en une depuis la fiche
            d&apos;un contrat actif.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {signatures.map((sig) => {
                const now = new Date();
                const isExpired = sig.expireA < now && sig.statut !== "COMPLETEE";
                return (
                  <li
                    key={sig.id}
                    className="flex flex-wrap items-center gap-3 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/contrats/${sig.contract.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {sig.contract.numero}
                        </Link>
                        <span className="text-sm font-medium">
                          {sig.contract.prospect.raisonSociale}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`font-normal ${STATUT_BADGE[sig.statut]}`}
                        >
                          {isExpired ? "Expirée" : STATUT_LABEL[sig.statut]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Lien : <code className="font-mono">/sign/{sig.lienSignature.slice(0, 12)}…</code>
                        {" · "}
                        Expire {formatDateLong(sig.expireA)}
                      </p>
                      <p className="mt-0.5 text-xs">
                        {sig.signeParClient && (
                          <span className="text-emerald-700">
                            ✓ Client (
                            {sig.dateSignatureClient
                              ? formatDateLong(sig.dateSignatureClient)
                              : "—"}
                            )
                          </span>
                        )}
                        {sig.signeParClient && sig.signeParAclr && " · "}
                        {sig.signeParAclr && (
                          <span className="text-emerald-700">
                            ✓ ACLR (
                            {sig.dateSignatureAclr
                              ? formatDateLong(sig.dateSignatureAclr)
                              : "—"}
                            )
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/sign/${sig.lienSignature}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-xs hover:bg-muted"
                      >
                        Ouvrir le lien
                      </a>
                      {sig.signeParClient &&
                        !sig.signeParAclr &&
                        user.role === "ADMIN" && (
                          <SignAclrButton signatureId={sig.id} />
                        )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
