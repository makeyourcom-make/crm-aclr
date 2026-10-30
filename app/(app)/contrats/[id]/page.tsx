import {
  Banknote,
  ChevronLeft,
  ExternalLink,
  FileSignature,
  Info,
  Package,
  Pencil,
  QrCode,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { formatInt } from "@/components/arena/format";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import type { Tone } from "@/components/arena/tones";
import { RecomputeButton } from "@/components/commissions/recompute-button";
import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { DeleteContractButton } from "@/components/common/entity-delete-buttons";
import { ContractLifecycle, CommissionDots } from "@/components/contrats/contract-lifecycle";
import { ContractStatutBadge } from "@/components/contrats/contract-statut-badge";
import { ProjectMarginBox } from "@/components/contrats/project-margin-box";
import { ResilierButton } from "@/components/contrats/resilier-button";
import { UploadSignedPdfButton } from "@/components/contrats/upload-signed-pdf-button";
import { ValidateContractButton } from "@/components/contrats/validate-contract-button";
import { ClientInvoiceStatusPill, CLIENT_INVOICE_TYPE_LABEL } from "@/components/factures-clients/invoice-status";
import { MarkInvoicePaidButton } from "@/components/paiements/mark-invoice-paid-button";
import { PaymentStatutBadge } from "@/components/paiements/payment-statut-badge";
import { RecordPaymentButton } from "@/components/paiements/record-payment-button";
import { PageHeader } from "@/components/page-header";
import { SignAclrButton } from "@/components/signatures/sign-aclr-button";
import { SignatureQrPanel } from "@/components/signatures/signature-qr-panel";
import {
  effectiveSignatureStatut,
  SignatureStatusPill,
} from "@/components/signatures/signature-status";
import { SignInPersonButton } from "@/components/signatures/sign-in-person-button";
import { getNextRenewalDate, relativeDays } from "@/lib/contract-renewal";
import { formatCHF, formatDate, formatDateLong, formatMoney } from "@/lib/format";
import { publicBaseUrl } from "@/lib/public-url";
import { getContractById } from "@/lib/queries/contracts";
import { getProjectMarginForContract } from "@/lib/queries/project-profitability";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

import type { CommissionPaymentTypePart } from "@prisma/client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Contrat ${id.slice(0, 8)}…` };
}

const TYPE_PART_LABEL: Record<CommissionPaymentTypePart, string> = {
  SIGNATURE: "Signature",
  ETALEMENT: "Étalement",
  RENOUVELLEMENT: "Renouvellement",
};

const COMMISSION_STATUT: Record<string, { label: string; tone: Tone }> = {
  PREVU: { label: "À venir", tone: "navy" },
  PAYE: { label: "Acquise", tone: "green" },
  ANNULE: { label: "Annulée", tone: "red" },
};

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  ACOMPTE: "Acompte",
  SOLDE: "Solde",
  MENSUALITE: "Mensualité",
};

const MODALITE_LABEL: Record<string, string> = {
  CINQUANTE_CINQUANTE: "50 / 50",
  ONESHOT_PUIS_MENSUEL: "One-shot puis mensuel",
};

const OUTLINE_LINK =
  "inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-border-strong bg-card px-3.5 text-sm font-bold text-foreground transition-colors hover:bg-navy-50";

const TH =
  "px-3 py-3 text-left text-[11px] font-bold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase";
const TD = "px-3 py-2.5 align-middle";
const TR = "border-b border-border transition-colors last:border-0 hover:bg-navy-50/70";

const INFO_TONE: Record<"info" | "violet" | "ok" | "amber" | "red" | "navy", { box: string; title: string }> = {
  info: { box: "bg-info-50", title: "text-info-700" },
  violet: { box: "bg-lvl-50", title: "text-lvl-700" },
  ok: { box: "bg-win-50", title: "text-win-700" },
  amber: { box: "bg-gold-50", title: "text-gold-700" },
  red: { box: "bg-alert-50", title: "text-alert-700" },
  navy: { box: "bg-navy-50", title: "text-navy-700" },
};

export default async function ContractDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const contract = await getContractById(user, id);

  if (!contract) notFound();

  const isAdmin = user.role === "ADMIN";
  const now = new Date();

  // Rentabilité projet : admin only
  const margin = isAdmin ? await getProjectMarginForContract(id) : null;

  // ── Signature par QR code (client + commercial) ──────────────────────────
  // Fenêtre de signature : contrat pas encore actif / terminé.
  const signatureWindow =
    contract.statut === "ATTENTE_SIGNATURE_CLIENT" ||
    contract.statut === "ATTENTE_VALIDATION_ADMIN";
  const activeSig =
    contract.signatures.find(
      (s) => s.statut !== "COMPLETEE" && s.expireA > now,
    ) ?? null;
  const lastSig = contract.signatures[0] ?? null;
  // URL absolue OBLIGATOIRE pour le QR (un lien relatif n'est pas scannable :
  // le téléphone le prend pour du texte). publicBaseUrl() dérive l'hôte réel
  // de la requête MAIS ignore tout host local (localhost → lien injoignable
  // pour le client qui scanne), avec repli APP_URL / prod.
  const appUrl = await publicBaseUrl();
  let clientSignUrl: string | null = null;
  let aclrSignUrl: string | null = null;
  let clientQr: string | null = null;
  let aclrQr: string | null = null;
  if (signatureWindow && activeSig) {
    clientSignUrl = `${appUrl}/sign/${activeSig.lienSignature}`;
    aclrSignUrl = `${appUrl}/sign/${activeSig.lienSignature}/aclr`;
    [clientQr, aclrQr] = await Promise.all([
      QRCode.toDataURL(clientSignUrl, { margin: 1, width: 240 }),
      QRCode.toDataURL(aclrSignUrl, { margin: 1, width: 240 }),
    ]);
  }

  const commission = contract.commissions[0]; // 1 commission par contrat

  // Prix par ligne PROPRES au contrat (lignesMeta) : pas le prix catalogue.
  const lignesMetaArr = Array.isArray(contract.lignesMeta)
    ? (contract.lignesMeta as unknown as Array<{
        productId: string;
        prixOneShotOriginal?: number | null;
        prixMensuelOriginal?: number | null;
      }>)
    : [];
  const prixLigneByProduct = new Map(
    lignesMetaArr.map((m) => [
      m.productId,
      {
        oneShot: m.prixOneShotOriginal ?? null,
        mensuel: m.prixMensuelOriginal ?? null,
      },
    ]),
  );

  // ── Cycle de vie (données réelles) ───────────────────────────────────────
  const executed = ["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"].includes(contract.statut);
  const clientSig = contract.signatures.find((s) => s.signeParClient) ?? null;
  const aclrSig = contract.signatures.find((s) => s.signeParAclr) ?? null;
  const firstPaid =
    contract.payments.find((p) => p.statut === "ENCAISSE") ?? null;
  const lifecycle = [
    { label: "Créé", done: true, date: contract.createdAt },
    {
      label: "Signé client",
      done: !!clientSig || executed || contract.statut === "ATTENTE_VALIDATION_ADMIN",
      date: clientSig?.dateSignatureClient ?? (executed ? contract.dateSignature : null),
    },
    {
      label: "Contre-signé",
      done: !!aclrSig || executed,
      date: aclrSig?.dateSignatureAclr ?? null,
    },
    { label: "Validé", done: executed, date: contract.valideALe },
    { label: "1er paiement", done: !!firstPaid, date: firstPaid?.date ?? null },
  ];

  const renewal = getNextRenewalDate({
    dateDebut: contract.dateDebut,
    dureeMois: contract.dureeMois,
    statut: contract.statut,
    reconductible: contract.reconductible,
  });
  const renewalRel = renewal ? relativeDays(renewal) : null;

  // ── Bandeau d'info selon le statut ───────────────────────────────────────
  const valeurAn1 = Number(contract.valeurAn1);
  let info: { tone: keyof typeof INFO_TONE; title: string; text: string };
  switch (contract.statut) {
    case "ATTENTE_SIGNATURE_CLIENT":
      if (lastSig?.signeParClient && !lastSig.signeParAclr) {
        info = {
          tone: "violet",
          title: "Le client a signé",
          text: `Signé le ${formatDate(lastSig.dateSignatureClient)}. Reste la contre-signature commerciale.`,
        };
      } else if (activeSig) {
        info = {
          tone: "info",
          title: "Signature en cours",
          text: `Lien valable jusqu'au ${formatDate(activeSig.expireA)}. ${formatInt(valeurAn1)} CHF an 1 en jeu.`,
        };
      } else if (lastSig) {
        info = {
          tone: "red",
          title: `Lien expiré le ${formatDate(lastSig.expireA)}`,
          text: "Génère un nouveau lien valable 14 jours et rappelle le client.",
        };
      } else {
        info = {
          tone: "navy",
          title: "Pas encore de lien de signature",
          text: "Prépare les QR codes ou envoie le contrat par mail depuis le pipeline.",
        };
      }
      break;
    case "ATTENTE_VALIDATION_ADMIN":
      info = {
        tone: "violet",
        title: "Signatures reçues",
        text: "Le feu vert admin passe le contrat en Actif et lance la facturation.",
      };
      break;
    case "ACTIF":
      if (renewal && renewalRel) {
        info =
          renewalRel.days <= 30
            ? {
                tone: "amber",
                title: `Renouvellement le ${formatDate(renewal)} · J-${Math.max(0, renewalRel.days)}`,
                text: `${formatInt(valeurAn1)} CHF an 1 à sécuriser : cale un point avec le client cette semaine.`,
              }
            : {
                tone: "ok",
                title: `Prochain renouvellement le ${formatDate(renewal)}`,
                text: `Dans ${formatInt(renewalRel.days)} jours. Facturation active.`,
              };
      } else {
        info = {
          tone: "ok",
          title: "Contrat actif",
          text: "Durée ferme : pas de renouvellement prévu. Facturation active.",
        };
      }
      break;
    case "SUSPENDU":
      info = {
        tone: "amber",
        title: "Facturation en pause",
        text: contract.facturationReprendLe
          ? `Reprise prévue le ${formatDate(contract.facturationReprendLe)}.`
          : "Aucune date de reprise renseignée.",
      };
      break;
    case "RESILIE":
      info = {
        tone: "red",
        title: contract.dateResiliation
          ? `Résilié le ${formatDate(contract.dateResiliation)}`
          : "Contrat résilié",
        text: "Commissions à venir annulées, versements payés conservés.",
      };
      break;
    default:
      info = {
        tone: "navy",
        title: "Arrivé à échéance",
        text: "Plus de facturation sur ce contrat.",
      };
  }
  const infoTone = INFO_TONE[info.tone];

  const canEdit =
    contract.statut === "ATTENTE_SIGNATURE_CLIENT" &&
    !contract.signatures.some((s) => s.signeParClient) &&
    !contract.clientInvoices.some((f) => f.statut === "PAYEE");

  const offres = contract.products.map((p) => p.nom).join(" · ");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 [&>div:first-child]:mb-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="finance"
        title={contract.prospect.raisonSociale}
        breadcrumb={
          <Link
            href="/contrats"
            className="inline-flex items-center gap-1 text-[13px] font-bold text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Retour aux contrats
          </Link>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="font-bold text-foreground tabular-nums">{contract.numero}</span>
            <ContractStatutBadge statut={contract.statut} />
            <span>
              Signé le {formatDateLong(contract.dateSignature)} · {contract.dureeMois} mois
            </span>
            {contract.dateResiliation && (
              <span className="font-semibold text-alert-700">
                · Résilié le {formatDate(contract.dateResiliation)}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <DocumentPreviewButton
              url={`/api/contrats/${contract.id}/pdf`}
              filename={`${contract.numero}.pdf`}
              label="Aperçu PDF (avec CGV)"
              icon="Eye"
              className="h-9 gap-1.5 rounded-[12px] border-border-strong bg-card px-3.5 text-sm font-bold hover:bg-navy-50"
            />
            {/* Lien direct conservé pour utilisateurs qui veulent ouvrir dans un onglet */}
            <a
              href={`/api/contrats/${contract.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className={OUTLINE_LINK}
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              Onglet
            </a>
            {/* Modifier : réservé aux contrats non signés et non payés */}
            {canEdit && (
              <Link href={`/contrats/${contract.id}/modifier`} className={OUTLINE_LINK}>
                <Pencil aria-hidden="true" className="size-4" />
                Modifier
              </Link>
            )}
            {/* Bouton validation admin : contrat signé client, à valider */}
            {contract.statut === "ATTENTE_VALIDATION_ADMIN" && isAdmin && (
              <ValidateContractButton
                contractId={contract.id}
                clientName={contract.prospect.raisonSociale}
                montantMensuel={Number(contract.montantMensuel)}
                assigneeName={contract.assigneA.name}
                variant="hero"
              />
            )}
            {/* Upload du PDF signé : visible tant qu'aucun PDF signé n'est
                archivé (couvre aussi un contrat déjà signé dont le PDF signé
                n'a jamais été stocké : on peut alors joindre la copie reçue). */}
            {(contract.statut === "ACTIF" ||
              contract.statut === "ATTENTE_SIGNATURE_CLIENT") &&
              !contract.signatures.some((s) => s.documentSigneUrl) && (
                <UploadSignedPdfButton contractId={contract.id} />
              )}
            {contract.statut === "ACTIF" && (
              <>
                <SignInPersonButton
                  contractId={contract.id}
                  existingToken={
                    contract.signatures.find(
                      (s) => s.statut !== "COMPLETEE" && s.expireA > now,
                    )?.lienSignature ?? null
                  }
                />
                {isAdmin && (
                  <RecordPaymentButton
                    contractId={contract.id}
                    factures={contract.clientInvoices
                      .filter((f) => f.statut !== "PAYEE")
                      .map((f) => ({
                        id: f.id,
                        numero: f.numero,
                        type: f.type,
                        total: f.total.toString(),
                        statut: f.statut,
                      }))}
                  />
                )}
                <ResilierButton contractId={contract.id} />
              </>
            )}
            {isAdmin && (
              <DeleteContractButton
                contractId={contract.id}
                canDelete={
                  (contract.statut === "ATTENTE_SIGNATURE_CLIENT" ||
                    contract.statut === "ATTENTE_VALIDATION_ADMIN") &&
                  !contract.clientInvoices.some((f) => f.statut === "PAYEE")
                }
              />
            )}
          </>
        }
      />

      {/* Fiche express : cycle de vie, montants, commission */}
      <section
        aria-label="Fiche express du contrat"
        className="flex flex-col gap-5 rounded-[20px] border border-border bg-card p-5 shadow-arena-lg sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              {contract.prospect.ville ? `${contract.prospect.ville} · ` : ""}
              {contract.assigneA.name}
            </p>
            <p className="mt-1 text-sm font-semibold break-words text-foreground">
              {offres || "Aucune offre liée"}
            </p>
          </div>
        </div>

        <ContractLifecycle steps={lifecycle} />

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <MiniKpi
            label="Valeur totale"
            value={formatMoney(
              Number(contract.montantOneShot) +
                Number(contract.montantMensuel) * contract.dureeMois,
              contract.devise,
            )}
            sub={`sur ${contract.dureeMois} mois`}
          />
          <MiniKpi
            label="Valeur an 1"
            value={formatMoney(valeurAn1, contract.devise)}
            sub="mensuel × 12 (indicatif)"
          />
          <MiniKpi
            label="One-shot"
            value={formatMoney(Number(contract.montantOneShot), contract.devise)}
            sub={MODALITE_LABEL[contract.modalitePaiement] ?? contract.modalitePaiement.replace(/_/g, " ")}
          />
          <MiniKpi
            label="Mensuel récurrent"
            value={formatMoney(Number(contract.montantMensuel), contract.devise)}
            sub="par mois"
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className={cn("flex items-start gap-2.5 rounded-[14px] px-3.5 py-3", infoTone.box)}>
            <Info aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", infoTone.title)} />
            <div className="min-w-0">
              <p className={cn("text-[13px] font-extrabold", infoTone.title)}>{info.title}</p>
              <p className="mt-0.5 text-xs text-foreground">{info.text}</p>
            </div>
          </div>
          {commission ? (
            <CommissionDots
              ownerName={contract.assigneA.name.split(" ")[0] ?? contract.assigneA.name}
              total={Number(commission.montantTotal)}
              dots={commission.payments.map((p) => ({
                id: p.id,
                typePart: p.typePart,
                statut: p.statut,
                montant: Number(p.montant),
              }))}
            />
          ) : (
            <div className="rounded-[14px] border border-border p-3.5 text-[13px] text-muted-foreground">
              <strong className="text-foreground">Pas de commission</strong> sur ce
              contrat pour l&apos;instant.
            </div>
          )}
        </div>
      </section>

      {/* Rentabilité projet : admin uniquement */}
      {isAdmin && margin && <ProjectMarginBox margin={margin} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Infos générales */}
        <SectionCard title="Infos générales" icon={FileSignature} tone="navy">
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Field label="Commerciale">{contract.assigneA.name}</Field>
            <Field label="Modalité de paiement">
              {contract.modalitePaiement.replace(/_/g, " ")}
            </Field>
            <Field label="Date de début">{formatDateLong(contract.dateDebut)}</Field>
            <Field label="Prochain renouvellement">
              {renewal && renewalRel ? (
                <span className={renewalRel.days < 30 ? "font-bold text-gold-700" : ""}>
                  {formatDateLong(renewal)} ({renewalRel.label})
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Pas de renouvellement prévu
                </span>
              )}
            </Field>
            {contract.deal && (
              <Field label="Deal d'origine" className="sm:col-span-2">
                <Link
                  href="/pipeline"
                  className="font-bold text-info-700 underline-offset-2 hover:underline"
                >
                  {contract.deal.titre}
                </Link>
              </Field>
            )}
            {contract.raisonResiliation && (
              <Field label="Raison de résiliation" className="sm:col-span-2">
                <p className="rounded-[12px] bg-alert-50 px-3 py-2 text-alert-700">
                  {contract.raisonResiliation}
                </p>
              </Field>
            )}
          </dl>
        </SectionCard>

        {/* Produits du contrat */}
        <SectionCard
          title={`Produits (${contract.products.length})`}
          icon={Package}
          tone="violet"
        >
          {contract.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun produit lié.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {contract.products.map((p) => {
                const ligne = prixLigneByProduct.get(p.id);
                const oneShot =
                  ligne?.oneShot ??
                  (p.prixOneShot != null ? Number(p.prixOneShot) : null);
                const mensuel =
                  ligne?.mensuel ??
                  (p.prixMensuel != null ? Number(p.prixMensuel) : null);
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-ground px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold">{p.nom}</span>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {oneShot ? `${formatCHF(oneShot)} one-shot` : ""}
                      {oneShot && mensuel ? " · " : ""}
                      {mensuel ? `${formatCHF(mensuel)} / mois` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Signature par QR code : client + commercial, retour live */}
      {signatureWindow &&
        (activeSig || contract.statut === "ATTENTE_SIGNATURE_CLIENT" ? (
          <SectionCard
            title="Signer le contrat"
            icon={QrCode}
            tone="blue"
            description={`${contract.numero} · ${contract.prospect.raisonSociale}`}
          >
            <SignatureQrPanel
              contractId={contract.id}
              signatureId={activeSig?.id ?? null}
              clientUrl={clientSignUrl}
              aclrUrl={aclrSignUrl}
              clientQrDataUrl={clientQr}
              aclrQrDataUrl={aclrQr}
              initial={
                activeSig
                  ? {
                      signeParClient: activeSig.signeParClient,
                      signeParAclr: activeSig.signeParAclr,
                      nomClient: activeSig.nomClient,
                      nomAclr: activeSig.nomAclr,
                      signatureClientDataUrl: activeSig.signatureClientDataUrl,
                      signatureAclrDataUrl: activeSig.signatureAclrDataUrl,
                    }
                  : null
              }
            />
          </SectionCard>
        ) : (
          // En attente de validation et plus de lien actif : les signatures
          // sont posées (ou le PDF papier joint). Pas de nouveau QR à générer.
          <SectionCard
            title="Prêt pour validation"
            icon={ShieldCheck}
            tone="violet"
            description="Les signatures sont reçues : c'est toujours l'admin qui valide à la fin."
            action={
              isAdmin ? (
                <ValidateContractButton
                  contractId={contract.id}
                  clientName={contract.prospect.raisonSociale}
                  montantMensuel={Number(contract.montantMensuel)}
                  assigneeName={contract.assigneA.name}
                  variant="hero"
                />
              ) : (
                <StatusPill tone="violet">En attente du feu vert admin</StatusPill>
              )
            }
          >
            {lastSig?.signeParClient &&
              !lastSig.signeParAclr &&
              (isAdmin || contract.assigneAId === user.id) && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-coral-50 px-4 py-3">
                  <p className="text-sm">
                    <strong className="text-coral-600">Le client a signé.</strong>{" "}
                    La contre-signature commerciale manque encore.
                  </p>
                  <SignAclrButton signatureId={lastSig.id} size="default" />
                </div>
              )}
          </SectionCard>
        ))}

      {/* Signatures électroniques : audit complet */}
      {contract.signatures.length > 0 && (
        <SectionCard
          title={`Signatures (${contract.signatures.length})`}
          icon={FileSignature}
          tone="violet"
          description="Audit : noms, dates, IP et tracés"
        >
          <div className="flex flex-col gap-3">
            {contract.signatures.map((sig) => {
              return (
                <div
                  key={sig.id}
                  className="rounded-[16px] border border-border bg-ground p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <SignatureStatusPill
                      statut={effectiveSignatureStatut(sig.statut, sig.expireA, now)}
                    />
                    <span className="font-semibold text-muted-foreground">
                      Lien {sig.expireA > now ? "expire" : "expiré"} le {formatDate(sig.expireA)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {/* Bloc client */}
                    <div className="rounded-[14px] border border-border bg-card p-3.5">
                      <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                        Client
                      </p>
                      {sig.signeParClient ? (
                        <>
                          <p className="mt-1 text-sm font-bold">{sig.nomClient ?? "-"}</p>
                          <p className="text-xs text-muted-foreground">
                            Signé le{" "}
                            {sig.dateSignatureClient
                              ? formatDateLong(sig.dateSignatureClient)
                              : "-"}
                            {sig.ipClient && (
                              <>
                                <br />
                                IP : <code className="font-mono">{sig.ipClient}</code>
                              </>
                            )}
                          </p>
                          {sig.signatureClientDataUrl && (
                            <div className="mt-2 overflow-hidden rounded-[10px] border border-border bg-white p-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={sig.signatureClientDataUrl}
                                alt="Signature manuscrite du client"
                                className="h-24 w-full object-contain"
                              />
                            </div>
                          )}
                          {sig.documentSigneUrl && (
                            <div className="mt-2">
                              <DocumentPreviewButton
                                url={sig.documentSigneUrl}
                                filename={`${contract.numero}-signe.pdf`}
                                label="Voir le PDF signé reçu"
                                icon="Eye"
                                className="h-8 gap-1.5 rounded-[10px] border-border-strong bg-card px-3 text-xs font-bold hover:bg-navy-50"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          En attente de signature client
                        </p>
                      )}
                    </div>

                    {/* Bloc ACLR */}
                    <div className="rounded-[14px] border border-border bg-card p-3.5">
                      <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                        ACLR Sàrl
                      </p>
                      {sig.signeParAclr ? (
                        <>
                          <p className="mt-1 text-sm font-bold text-win-700">
                            Signé{sig.nomAclr ? ` · ${sig.nomAclr}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Le{" "}
                            {sig.dateSignatureAclr
                              ? formatDateLong(sig.dateSignatureAclr)
                              : "-"}
                          </p>
                          {sig.signatureAclrDataUrl && (
                            <div className="mt-2 overflow-hidden rounded-[10px] border border-border bg-white p-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={sig.signatureAclrDataUrl}
                                alt="Signature manuscrite du commercial"
                                className="h-24 w-full object-contain"
                              />
                            </div>
                          )}
                        </>
                      ) : sig.signeParClient &&
                        (isAdmin || contract.assigneAId === user.id) ? (
                        <>
                          <p className="mt-1 text-sm font-semibold text-gold-700">
                            En attente de la signature du commercial
                          </p>
                          <div className="mt-2">
                            <SignAclrButton signatureId={sig.id} />
                          </div>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">En attente</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Factures clients */}
      <SectionCard
        title={`Factures clients (${contract.clientInvoices.length})`}
        icon={Receipt}
        tone="navy"
        contentClassName="-mx-5 sm:-mx-6"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="border-y border-border bg-ground/80">
              <tr>
                <th className={TH}>N°</th>
                <th className={TH}>Émise le</th>
                <th className={TH}>Échéance</th>
                <th className={TH}>Type</th>
                <th className={cn(TH, "text-right")}>Total</th>
                <th className={TH}>Statut</th>
                <th className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contract.clientInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    Aucune facture.
                  </td>
                </tr>
              ) : (
                contract.clientInvoices.map((inv) => {
                  const overdue = inv.statut === "ENVOYEE" && inv.dateEcheance < now;
                  return (
                    <tr key={inv.id} className={cn(TR, overdue && "bg-coral-50/60")}>
                      <td className={cn(TD, "font-bold tabular-nums")}>{inv.numero}</td>
                      <td className={cn(TD, "whitespace-nowrap")}>{formatDate(inv.dateEmission)}</td>
                      <td className={cn(TD, "whitespace-nowrap", overdue && "font-bold text-alert-700")}>
                        {formatDate(inv.dateEcheance)}
                      </td>
                      <td className={TD}>{CLIENT_INVOICE_TYPE_LABEL[inv.type] ?? inv.type}</td>
                      <td className={cn(TD, "text-right font-extrabold whitespace-nowrap tabular-nums")}>
                        {formatMoney(Number(inv.total), inv.devise)}
                      </td>
                      <td className={TD}>
                        <ClientInvoiceStatusPill statut={inv.statut} overdue={overdue} />
                      </td>
                      <td className={cn(TD, "text-right")}>
                        <div className="flex items-center justify-end gap-1.5">
                          <DocumentPreviewButton
                            url={`/api/factures-clients/${inv.id}/pdf`}
                            filename={`${inv.numero}.pdf`}
                            label="Voir"
                            className="h-8 gap-1.5 rounded-[10px] border-border-strong bg-card px-3 text-xs font-bold hover:bg-navy-50"
                          />
                          {contract.statut === "ACTIF" && isAdmin && (
                            <MarkInvoicePaidButton
                              invoiceId={inv.id}
                              numero={inv.numero}
                              clientName={contract.prospect.raisonSociale}
                              total={Number(inv.total)}
                              devise={inv.devise}
                              hidden={inv.statut === "PAYEE" || inv.statut === "ANNULEE"}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Paiements reçus */}
      <SectionCard
        title={`Paiements reçus (${contract.payments.length})`}
        icon={Banknote}
        tone="green"
        contentClassName="-mx-5 sm:-mx-6"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead className="border-y border-border bg-ground/80">
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>Type</th>
                <th className={TH}>Référence</th>
                <th className={cn(TH, "text-right")}>Montant</th>
                <th className={TH}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {contract.payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Aucun paiement encore enregistré.
                  </td>
                </tr>
              ) : (
                contract.payments.map((pay) => (
                  <tr key={pay.id} className={TR}>
                    <td className={cn(TD, "whitespace-nowrap")}>{formatDate(pay.date)}</td>
                    <td className={TD}>{PAYMENT_TYPE_LABEL[pay.type] ?? pay.type}</td>
                    <td className={cn(TD, "tabular-nums")}>
                      {pay.referenceFactureClient ?? "-"}
                    </td>
                    <td className={cn(TD, "text-right font-extrabold whitespace-nowrap tabular-nums")}>
                      {formatCHF(Number(pay.montant))}
                    </td>
                    <td className={TD}>
                      <PaymentStatutBadge statut={pay.statut} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Planning commissions */}
      {commission && (
        <SectionCard
          title={`Planning commissions (${commission.payments.length})`}
          icon={Wallet}
          tone="gold"
          description={
            <>
              <strong className="text-foreground">
                {Math.round(Number(contract.assigneA.tauxCommissionSignature) * 100)} % de la valeur du contrat sur sa
                durée réelle (budget pub exclu)
              </strong>{" "}
              = {formatCHF(Number(commission.montantTotal))}. Versée 50 % à la signature,
              50 % étalés sur les mois restants ; puis{" "}
              {Math.round(Number(contract.assigneA.tauxCommissionRenouvellement) * 100)} % du mensuel chaque mois après
              le terme. « Acquise » = déjà gagné ; le versement a lieu via la facture mensuelle.
            </>
          }
          action={isAdmin ? <RecomputeButton /> : undefined}
          contentClassName="-mx-5 sm:-mx-6"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-[13px]">
              <thead className="border-y border-border bg-ground/80">
                <tr>
                  <th className={TH}>Type</th>
                  <th className={TH}>Mois</th>
                  <th className={TH}>Date prévue</th>
                  <th className={cn(TH, "text-right")}>Montant</th>
                  <th className={TH}>Statut</th>
                  <th className={TH}>Acquise le</th>
                </tr>
              </thead>
              <tbody>
                {commission.payments.map((p) => {
                  const st = COMMISSION_STATUT[p.statut] ?? {
                    label: p.statut,
                    tone: "navy" as Tone,
                  };
                  return (
                    <tr key={p.id} className={TR}>
                      <td className={TD}>{TYPE_PART_LABEL[p.typePart]}</td>
                      <td className={cn(TD, "tabular-nums")}>{p.numeroMois ?? "-"}</td>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        {formatDate(p.dateVersementPrevue)}
                      </td>
                      <td className={cn(TD, "text-right font-bold whitespace-nowrap tabular-nums")}>
                        {formatCHF(Number(p.montant))}
                      </td>
                      <td className={TD}>
                        <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>
                        {p.dateVersement ? `acquise ${formatDate(p.dateVersement)}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function MiniKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-[14px] bg-ground p-3">
      <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="score-number mt-1 text-base break-words sm:text-xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-foreground">{children}</dd>
    </div>
  );
}
