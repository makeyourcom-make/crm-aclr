import {
  CalendarClock,
  FileSignature,
  Fingerprint,
  Hourglass,
  QrCode,
  Radio,
  ShieldCheck,
  Upload,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/arena/empty-state";
import { formatInt } from "@/components/arena/format";
import { SectionCard } from "@/components/arena/section-card";
import { StatTile } from "@/components/arena/stat-tile";
import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { RoleFinanceHero } from "@/components/contrats/finance-hero-presets";
import { FinanceTabs } from "@/components/contrats/finance-tabs";
import { UploadSignedPdfButton } from "@/components/contrats/upload-signed-pdf-button";
import { ValidateContractButton } from "@/components/contrats/validate-contract-button";
import { PageHeader } from "@/components/page-header";
import { SignAclrButton } from "@/components/signatures/sign-aclr-button";
import {
  effectiveSignatureStatut,
  SignatureStatusPill,
  signatureMode,
} from "@/components/signatures/signature-status";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  getFinancePulse,
  getSignaturesOverview,
  type SignatureRow,
} from "@/lib/queries/contracts";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Signatures" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

const AUDIT_GRID =
  "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(110px,0.8fr)_minmax(110px,0.7fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(110px,0.7fr)_auto] md:items-center md:gap-3";

export default async function SignaturesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const [pulse, overview] = await Promise.all([
    getFinancePulse(user),
    getSignaturesOverview(user),
  ]);
  const now = new Date();
  const nowMs = now.getTime();

  const pendingContract = (r: SignatureRow) =>
    r.contract.statut === "ATTENTE_SIGNATURE_CLIENT" ||
    r.contract.statut === "ATTENTE_VALIDATION_ADMIN";

  // Signatures en cours : lien actif d'un contrat encore en attente
  // (la plus récente par contrat).
  const seen = new Set<string>();
  const live: SignatureRow[] = [];
  for (const r of overview.rows) {
    if (seen.has(r.contract.id)) continue;
    if (!pendingContract(r)) continue;
    if (r.statut === "COMPLETEE" || r.expireA.getTime() <= nowMs) continue;
    seen.add(r.contract.id);
    live.push(r);
  }
  live.sort((a, b) => a.expireA.getTime() - b.expireA.getTime());

  const expiringSoon = live.filter((r) => r.expireA.getTime() - nowMs <= 7 * DAY).length;
  const expiredCount = overview.rows.filter(
    (r) =>
      r.contract.statut === "ATTENTE_SIGNATURE_CLIENT" &&
      r.statut !== "COMPLETEE" &&
      r.expireA.getTime() <= nowMs &&
      !live.some((l) => l.contract.id === r.contract.id),
  ).length;

  const canSign = (r: SignatureRow) => isAdmin || r.contract.assigneAId === user.id;

  return (
    <div className="flex flex-col gap-6 [&>div:first-child]:mb-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="finance"
        title="Signatures"
        description={`QR en RDV, liens par mail et contrats papier · ${pulse.dayLabel}`}
      />

      <RoleFinanceHero pulse={pulse} />

      <FinanceTabs
        active="signatures"
        isAdmin={isAdmin}
        counts={{
          contrats: pulse.aValider,
          factures: pulse.invoices
            ? pulse.invoices.draftsCount + pulse.invoices.overdueCount
            : undefined,
          signatures: pulse.enAttenteSignature,
        }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="En attente client"
          value={pulse.enAttenteSignature}
          sub="contrats à faire signer (lien actif ou expiré)"
          icon={Hourglass}
          tone="blue"
        />
        <StatTile
          label="À valider (admin)"
          value={pulse.aValider}
          sub={
            isAdmin
              ? "signatures reçues, ton feu vert manque"
              : "signatures reçues, feu vert admin attendu"
          }
          icon={ShieldCheck}
          tone="violet"
          href="/contrats?statut=ATTENTE_VALIDATION_ADMIN"
        />
        <StatTile
          label="Liens qui expirent"
          value={expiringSoon}
          sub={`sous 7 jours · ${formatInt(expiredCount)} déjà expiré${expiredCount > 1 ? "s" : ""}`}
          icon={CalendarClock}
          tone="gold"
        />
        <StatTile
          label={`Signés au doigt · ${pulse.monthLabel}`}
          value={overview.drawnThisMonth}
          sub="client signé sur téléphone ou tablette"
          icon={Fingerprint}
          tone="green"
        />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <SectionCard
          title={`Signatures en cours · ${formatInt(live.length)}`}
          icon={Radio}
          tone="coral"
          description="Liens actifs, du plus proche de l'expiration au plus lointain"
          className="flex-[2_1_520px]"
        >
          {live.length === 0 ? (
            <EmptyState
              icon={QrCode}
              title="Aucune signature en cours"
              description="Prépare les QR codes depuis la fiche d'un contrat en attente, ou signe en direct pendant ton prochain RDV."
              action={
                <Link
                  href="/contrats?statut=ATTENTE_SIGNATURE_CLIENT"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Contrats en attente de signature
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {live.map((r) => {
                const daysLeft = Math.max(0, Math.ceil((r.expireA.getTime() - nowMs) / DAY));
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-3 rounded-[16px] border border-border bg-ground p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/contrats/${r.contract.id}`}
                          className="text-[15px] font-extrabold break-words text-foreground hover:underline"
                        >
                          {r.contract.raisonSociale}
                        </Link>
                        <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                          {r.contract.numero} · {formatInt(r.contract.valeurAn1)} CHF an 1
                          {isAdmin ? ` · ${r.contract.assigneName}` : ""}
                        </p>
                      </div>
                      <SignatureStatusPill statut={r.statut} />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <SideState
                        title="Client"
                        signed={r.signeParClient}
                        detail={
                          r.signeParClient
                            ? `Signé le ${formatDate(r.dateSignatureClient)}${r.nomClient ? ` · ${r.nomClient}` : ""}`
                            : "Pas encore signé"
                        }
                      />
                      <SideState
                        title="Commercial · ACLR"
                        signed={r.signeParAclr}
                        detail={
                          r.signeParAclr
                            ? `Signé le ${formatDate(r.dateSignatureAclr)}${r.nomAclr ? ` · ${r.nomAclr}` : ""}`
                            : "Pas encore signé"
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-bold",
                          daysLeft <= 3 ? "text-gold-700" : "text-muted-foreground",
                        )}
                      >
                        Expire le {formatDate(r.expireA)} · J-{daysLeft}
                      </span>
                      <span className="ml-auto flex flex-wrap items-center gap-2">
                        <a
                          href={`/sign/${r.lienSignature}`}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}
                        >
                          Ouvrir le lien client
                        </a>
                        {r.signeParClient && !r.signeParAclr && canSign(r) && (
                          <SignAclrButton signatureId={r.id} className="h-9" />
                        )}
                        {isAdmin && r.contract.statut === "ATTENTE_VALIDATION_ADMIN" && (
                          <ValidateContractButton
                            contractId={r.contract.id}
                            clientName={r.contract.raisonSociale}
                            montantMensuel={r.contract.montantMensuel}
                            assigneeName={r.contract.assigneName}
                            size="sm"
                            className="h-9"
                          />
                        )}
                        <Link
                          href={`/contrats/${r.contract.id}`}
                          className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-9")}
                        >
                          <QrCode aria-hidden="true" />
                          Suivre en direct
                        </Link>
                      </span>
                    </div>
                    {r.contract.statut === "ATTENTE_SIGNATURE_CLIENT" &&
                      !r.documentSigneUrl &&
                      canSign(r) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                          <p className="text-xs text-muted-foreground">
                            Le client a signé sur papier ?
                          </p>
                          <UploadSignedPdfButton contractId={r.contract.id} />
                        </div>
                      )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Signé sur papier ?"
          icon={Upload}
          tone="navy"
          className="flex-[1_1_300px]"
        >
          <div className="flex flex-col gap-3.5">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Ouvre la fiche du contrat (ou utilise le bouton dans la liste) et
              joins le PDF ou la photo du contrat signé (20 MB max). Indique le nom
              du signataire : le scan doit être lisible et complet, garde
              l&apos;original signé. « Enregistrer et contre-signer » envoie le
              contrat en validation admin.
            </p>
            <div className="rounded-[14px] bg-lvl-50 px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
              <strong className="text-lvl-700">Le parcours QR.</strong> Le client
              scanne, coche les CGV et signe au doigt. Le commercial signe sur son
              propre QR. Les deux tracés remontent en direct sur la fiche du
              contrat, puis c&apos;est toujours l&apos;admin qui valide à la fin :
              « Valider le contrat » le passe en Actif. Lien valable 14 jours.
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Toutes les signatures"
        icon={FileSignature}
        tone="violet"
        description={`${formatInt(overview.rows.length)} demande${overview.rows.length > 1 ? "s" : ""} de signature${overview.rows.length >= 200 ? " (les 200 plus récentes)" : ""}`}
      >
        {overview.rows.length === 0 ? (
          <EmptyState icon={FileSignature} title="Aucune signature pour l'instant." />
        ) : (
          <div className="flex flex-col gap-2">
            <div
              className={cn(
                "hidden px-3.5 pb-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase",
                AUDIT_GRID,
              )}
            >
              <span>Contrat</span>
              <span>Mode</span>
              <span>Statut</span>
              <span>Côté client</span>
              <span>Côté ACLR</span>
              <span>Lien expire</span>
              <span className="text-right">Action</span>
            </div>
            <ul className="flex flex-col gap-2">
              {overview.rows.map((r) => {
                const eff = effectiveSignatureStatut(r.statut, r.expireA, now);
                const expired = eff === "EXPIREE";
                const closed = r.statut === "COMPLETEE";
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-[14px] border border-border bg-card p-3.5 text-[13px]",
                      AUDIT_GRID,
                    )}
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/contrats/${r.contract.id}`}
                        className="block truncate text-sm font-extrabold text-foreground hover:underline"
                      >
                        {r.contract.raisonSociale}
                      </Link>
                      <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {r.contract.numero}
                      </p>
                    </div>
                    <span className="font-semibold">{signatureMode(r)}</span>
                    <span>
                      <SignatureStatusPill statut={eff} />
                    </span>
                    <span className="text-xs">
                      {r.signeParClient
                        ? `Signé le ${formatDate(r.dateSignatureClient)}${r.ipClient ? ` · IP ${r.ipClient}` : ""}`
                        : "Pas encore signé"}
                    </span>
                    <span className="text-xs">
                      {r.signeParAclr
                        ? `Signé${r.nomAclr ? ` · ${r.nomAclr}` : ""} · ${formatDate(r.dateSignatureAclr)}`
                        : "En attente"}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        closed
                          ? "text-muted-foreground"
                          : expired
                            ? "text-alert-700"
                            : "text-gold-700",
                      )}
                    >
                      {closed
                        ? "Clôturé"
                        : expired
                          ? `${formatDate(r.expireA)} · expiré`
                          : formatDate(r.expireA)}
                    </span>
                    <span className="flex flex-wrap gap-2 md:justify-end">
                      {r.documentSigneUrl ? (
                        <DocumentPreviewButton
                          url={r.documentSigneUrl}
                          filename={`${r.contract.numero}-signe.pdf`}
                          label="PDF signé"
                          icon="Eye"
                          className="h-9 gap-1.5 rounded-[10px] border-border-strong bg-card px-3 text-[13px] font-bold hover:bg-navy-50"
                        />
                      ) : null}
                      <Link
                        href={`/contrats/${r.contract.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}
                      >
                        {expired && r.contract.statut === "ATTENTE_SIGNATURE_CLIENT"
                          ? "Nouveau lien"
                          : "Ouvrir"}
                      </Link>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function SideState({
  title,
  signed,
  detail,
}: {
  title: string;
  signed: boolean;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border-2 px-3 py-2.5",
        signed ? "border-win-500 bg-win-50" : "border-info-500/50 bg-card",
      )}
    >
      <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </p>
      <p className={cn("text-[13px] font-extrabold", signed ? "text-win-700" : "text-info-700")}>
        {signed ? "Signé" : "En attente"}
      </p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
