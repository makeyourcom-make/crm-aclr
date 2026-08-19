/**
 * Template PDF — Contrat ACLR Sàrl.
 *
 * Pages :
 *   1. Bon de commande / récapitulatif (parties, montants, produits)
 *   2+. CGV intégrales annexées
 *
 * Si une signature manuscrite client + date + IP sont fournies, on
 * affiche le bloc signature complet en bas de la page 1.
 */
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import { CGV_VERSION } from "@/lib/cgv";
import { formatMoney, formatDateLong } from "@/lib/format";
import { CgvPages } from "@/lib/pdf/cgv-pages";

export interface ContractPdfData {
  numero: string;
  /** "CHF" | "EUR" — devise dans laquelle tous les montants sont libellés */
  devise?: string;
  dateSignature: Date;
  dateDebut: Date;
  dureeMois: number;
  modalitePaiement: string;
  note?: string | null;
  montantOneShot: number;
  montantMensuel: number;
  valeurAn1: number;
  emetteur: {
    raisonSociale: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
    numeroIDE?: string;
    numeroTVA?: string;
    /**
     * Source du logo pour @react-pdf : data URL base64 (recommandé, portable
     * Windows/Linux) ou chemin disque. Absent → repli sur le bandeau navy.
     */
    logoPath?: string;
    /**
     * Bannière pleine largeur affichée tout en haut (bord à bord). Data URL
     * base64. Prioritaire sur `logoPath` si fournie.
     */
    bannerPath?: string;
    /** Hauteur en points de la bannière à pleine largeur A4 (calc. côté serveur). */
    bannerHeightPt?: number;
  };
  client: {
    raisonSociale: string;
    contactNom?: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
    /** Numéro IDE (Suisse CHE-XXX) ou SIRET (FR) ou similaire. */
    numeroIDE?: string;
    /** Numéro TVA si différent ou si applicable. */
    numeroTVA?: string;
  };
  /**
   * Liste des prestations vendues, avec le prix par ligne (frais unique
   * et/ou mensuel) issu du produit. ⚠️ Ces prix proviennent de la fiche
   * produit ; ils peuvent diverger des montants figés du contrat (override
   * à la signature, MAJ catalogue ultérieure). Les totaux en bas restent la
   * référence contractuelle.
   */
  produits: Array<{
    nom: string;
    description?: string | null;
    quantite?: number | null;
    /** Prix d'ORIGINE par unité (avant remise) — colonne "Prix". */
    prixOneShot?: number | null;
    prixMensuel?: number | null;
    /** Prix EFFECTIF par unité (après remise / offert) — colonne "Total". */
    prixOneShotEff?: number | null;
    prixMensuelEff?: number | null;
    offert?: boolean;
    remiseType?: "POURCENT" | "MONTANT" | null;
    remiseValeur?: number | null;
  }>;
  signature?: {
    nomClient?: string | null;
    dateSignatureClient?: Date | null;
    ipClient?: string | null;
    /** PNG data URL du tracé manuscrit. */
    signatureClientDataUrl?: string | null;
    signeParAclr?: boolean;
    dateSignatureAclr?: Date | null;
  };
}

const c = {
  primary: "#0E1936",
  coral: "#F47174",
  border: "#E2E8F0",
  muted: "#64748B",
};

/** Géométrie page A4 (points). Doit rester cohérent avec styles.page.padding. */
const PAGE_WIDTH = 595.28;
const PAGE_PADDING = 40;

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, fontFamily: "Helvetica", fontSize: 9, color: "#0F172A" },
  brandBar: { height: 6, backgroundColor: c.primary, marginBottom: 20 },
  logoHeader: { alignItems: "center", marginBottom: 22 },
  logoImage: { width: 84, height: 84, objectFit: "contain" },
  // Bannière pleine largeur : marges négatives = padding page (40) pour
  // déborder bord à bord en haut du document.
  bannerHeader: {
    marginTop: -PAGE_PADDING,
    marginLeft: -PAGE_PADDING,
    marginRight: -PAGE_PADDING,
    marginBottom: 22,
  },
  bannerImage: { width: PAGE_WIDTH, objectFit: "cover" },
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  partieBlock: { width: "48%" },
  partieLabel: {
    fontSize: 7,
    color: c.muted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  partieName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  partieLine: { marginBottom: 1 },
  titre: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
    marginBottom: 4,
  },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { color: c.muted, width: 130, fontSize: 8 },
  metaValue: { fontSize: 9 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: c.border,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: c.muted,
    textTransform: "uppercase",
  },
  // Un "groupe prestation" = nom + 1-2 lignes (one-shot / mensuel).
  prestaGroup: {
    flexDirection: "column",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: c.border,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  colNom: { width: "60%" },
  colOneShot: { width: "20%", textAlign: "right" },
  colMensuel: { width: "20%", textAlign: "right" },
  prestaNomText: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: c.primary },
  prestaDesc: {
    fontSize: 8,
    color: c.muted,
    marginTop: 2,
    marginBottom: 4,
    lineHeight: 1.3,
  },

  // En-tête du tableau des prestations
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: c.primary,
    paddingBottom: 5,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  // Cellules d'en-tête (gras, muet, majuscules) — mêmes largeurs que le corps.
  colNomHead: {
    width: "34%",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: c.muted,
    textTransform: "uppercase",
  },
  colQteHead: {
    width: "8%",
    textAlign: "center",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: c.muted,
    textTransform: "uppercase",
  },
  colPrixHead: {
    width: "22%",
    textAlign: "right",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: c.muted,
    textTransform: "uppercase",
  },
  colReductionHead: {
    width: "14%",
    textAlign: "right",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: c.muted,
    textTransform: "uppercase",
  },
  colTotalHead: {
    width: "22%",
    textAlign: "right",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: c.muted,
    textTransform: "uppercase",
  },
  // Cellules de corps — police homogène, alignées à droite pour les montants.
  colLabel: { width: "34%", fontSize: 8.5, color: c.muted, paddingLeft: 2 },
  colQte: { width: "8%", textAlign: "center", fontSize: 9, color: c.muted },
  colPrix: {
    width: "22%",
    textAlign: "right",
    fontSize: 9.5,
    color: c.primary,
  },
  colReduction: { width: "14%", alignItems: "flex-end", justifyContent: "center" },
  colTotal: {
    width: "22%",
    textAlign: "right",
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
  },
  badge: {
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeRemise: { backgroundColor: "#FEF3C7" },
  badgeText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
  },
  badgeOffert: { backgroundColor: "#DCFCE7" },
  badgeTextOffert: { color: "#15803D" },
  totauxBlock: {
    marginTop: 16,
    alignSelf: "flex-end",
    width: "55%",
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: { fontSize: 9, color: c.muted },
  totalValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totalFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.primary,
  },
  totalFinalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
  },
  totalFinalValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
  },
  signatureBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
    gap: 12,
  },
  signatureBox: {
    width: "48%",
    padding: 10,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 4,
    minHeight: 110,
  },
  signatureBoxLabel: {
    fontSize: 7,
    color: c.muted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  signatureImg: { width: "100%", height: 50, objectFit: "contain" },
  signatureMeta: { fontSize: 7.5, color: c.muted, marginTop: 4 },
  signatureName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
  cgvBanner: {
    marginTop: 18,
    padding: 8,
    backgroundColor: "#FFF7E6",
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    fontSize: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: c.muted,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: c.border,
    paddingTop: 8,
  },
});

/**
 * Choisit le bon libellé pour l'identifiant entreprise client.
 *   - CHE-XXX.XXX.XXX → "IDE" (Suisse)
 *   - 14 chiffres     → "Siret" (France)
 *   - 9 chiffres      → "Siren" (France)
 *   - sinon           → "N°"
 */
function clientIdLabel(numero: string, pays?: string): string {
  const clean = numero.trim().toUpperCase();
  if (clean.startsWith("CHE-") || clean.startsWith("CHE")) return "IDE";
  if (/^\d{14}$/.test(clean.replace(/\s/g, ""))) return "Siret";
  if (/^\d{9}$/.test(clean.replace(/\s/g, ""))) return "Siren";
  if (pays?.toLowerCase().includes("france")) return "Siret";
  return "N°";
}

const MODALITE_LABELS: Record<string, string> = {
  CINQUANTE_CINQUANTE: "50 % d'acompte à la commande / 50 % à la mise en ligne",
  CENT_AU_SIGNING: "100 % à la signature",
  MENSUEL: "Mensualisé sur la durée",
};

/**
 * Masque les descriptions auto-générées non destinées au client
 * (ex. « [Custom] Produit sur-mesure créé depuis un deal. »).
 */
function cleanPrestaDescription(desc?: string | null): string {
  if (!desc) return "";
  const t = desc.trim();
  if (t.startsWith("[Custom]")) return "";
  return t;
}

/**
 * Libellé prix d'une ligne de prestation : frais unique et/ou mensuel.
 *   - les deux    → "CHF 499.00 + CHF 29.90 / mois"
 *   - mensuel     → "CHF 29.90 / mois"
 *   - frais unique→ "CHF 499.00"
 *   - aucun prix  → "" (produit inclus / sur-mesure sans tarif ligne)
 */
/** Libellé court de la remise d'une ligne (−X% ou −X CHF), ou null. */
function remiseLabelOf(
  p: ContractPdfData["produits"][number],
  fmt: (n: number | null | undefined) => string,
): string | null {
  if (p.remiseType === "POURCENT" && p.remiseValeur) return `−${p.remiseValeur}%`;
  if (p.remiseType === "MONTANT" && p.remiseValeur) return `−${fmt(p.remiseValeur)}`;
  return null;
}

/** Pastille de réduction pour UNE part — affichée seulement si réduction. */
function ReductionBadge({
  orig,
  eff,
  offert,
  remiseLabel,
}: {
  orig: number;
  eff: number;
  offert: boolean;
  remiseLabel: string | null;
}) {
  if (eff >= orig) return null; // pas de réduction sur cette part
  const isOffert = offert && eff === 0;
  return (
    <View
      style={[styles.badge, isOffert ? styles.badgeOffert : styles.badgeRemise]}
    >
      <Text
        style={
          isOffert ? [styles.badgeText, styles.badgeTextOffert] : styles.badgeText
        }
      >
        {isOffert ? "OFFERT" : (remiseLabel ?? "Remise")}
      </Text>
    </View>
  );
}

export function ContractPdf({ data }: { data: ContractPdfData }) {
  const devise = data.devise ?? "CHF";
  const fmt = (n: number | null | undefined) => formatMoney(n, devise);

  return (
    <Document
      title={`Contrat ${data.numero}`}
      subject={`Contrat ${data.numero} - ${data.client.raisonSociale}`}
    >
      <Page size="A4" style={styles.page}>
        {/*
          En-tête, par ordre de priorité :
            1. Bannière pleine largeur (bord à bord) si fournie
            2. Logo Make Your Com centré
            3. Repli sur le bandeau navy plein
          Évite tout en-tête vide en cas de fichier manquant.
        */}
        {data.emetteur.bannerPath ? (
          <View style={styles.bannerHeader}>
            <Image
              src={data.emetteur.bannerPath}
              style={[
                styles.bannerImage,
                data.emetteur.bannerHeightPt
                  ? { height: data.emetteur.bannerHeightPt }
                  : {},
              ]}
            />
          </View>
        ) : data.emetteur.logoPath ? (
          <View style={styles.logoHeader}>
            <Image src={data.emetteur.logoPath} style={styles.logoImage} />
          </View>
        ) : (
          <View style={styles.brandBar} />
        )}

        <View style={styles.parties}>
          <View style={styles.partieBlock}>
            <Text style={styles.partieLabel}>Prestataire</Text>
            <Text style={styles.partieName}>
              {data.emetteur.raisonSociale}
            </Text>
            {data.emetteur.adresse && (
              <Text style={styles.partieLine}>{data.emetteur.adresse}</Text>
            )}
            <Text style={styles.partieLine}>
              {[data.emetteur.codePostal, data.emetteur.ville]
                .filter(Boolean)
                .join(" ")}
            </Text>
            {data.emetteur.pays && (
              <Text style={styles.partieLine}>{data.emetteur.pays}</Text>
            )}
            {data.emetteur.numeroIDE && (
              <Text style={styles.partieLine}>{data.emetteur.numeroIDE}</Text>
            )}
            {data.emetteur.numeroTVA && (
              <Text style={styles.partieLine}>{data.emetteur.numeroTVA}</Text>
            )}
          </View>

          <View style={styles.partieBlock}>
            <Text style={styles.partieLabel}>Client</Text>
            <Text style={styles.partieName}>{data.client.raisonSociale}</Text>
            {data.client.contactNom && (
              <Text style={styles.partieLine}>{data.client.contactNom}</Text>
            )}
            {data.client.adresse && (
              <Text style={styles.partieLine}>{data.client.adresse}</Text>
            )}
            <Text style={styles.partieLine}>
              {[data.client.codePostal, data.client.ville]
                .filter(Boolean)
                .join(" ")}
            </Text>
            {data.client.pays && (
              <Text style={styles.partieLine}>{data.client.pays}</Text>
            )}
            {data.client.numeroIDE && (
              <Text style={[styles.partieLine, { marginTop: 3 }]}>
                {clientIdLabel(data.client.numeroIDE, data.client.pays)} :{" "}
                {data.client.numeroIDE}
              </Text>
            )}
          </View>
        </View>

        <View>
          <Text style={styles.titre}>Bon de commande / Contrat</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>N° de contrat :</Text>
            <Text style={styles.metaValue}>{data.numero}</Text>
          </View>
          {/*
            Date de signature : affichée UNIQUEMENT si le client a réellement
            signé. Tant que le contrat n'est pas signé, la ligne est masquée
            (un document non signé n'a pas de date de signature).
          */}
          {data.signature?.dateSignatureClient && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date de signature :</Text>
              <Text style={styles.metaValue}>
                {formatDateLong(data.signature.dateSignatureClient)}
              </Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date de début :</Text>
            <Text style={styles.metaValue}>
              {formatDateLong(data.dateDebut)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Durée :</Text>
            <Text style={styles.metaValue}>{data.dureeMois} mois</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Modalité de paiement :</Text>
            <Text style={styles.metaValue}>
              {(MODALITE_LABELS[data.modalitePaiement] ??
                data.modalitePaiement) +
                (data.montantMensuel > 0 &&
                data.modalitePaiement === "CINQUANTE_CINQUANTE"
                  ? ", puis facturation mensuelle"
                  : "")}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Prestations</Text>

        {/* En-tête du tableau */}
        <View style={styles.tableHead}>
          <Text style={styles.colNomHead}>Détail</Text>
          <Text style={styles.colQteHead}>Qté</Text>
          <Text style={styles.colPrixHead}>Prix</Text>
          <Text style={styles.colReductionHead}>Réduction</Text>
          <Text style={styles.colTotalHead}>Total</Text>
        </View>

        {data.produits.map((p, i) => {
          const desc = cleanPrestaDescription(p.description);
          const qte = p.quantite ?? 1;
          const duree = data.dureeMois ?? 12;
          const remiseLabel = remiseLabelOf(p, fmt);
          // Une part par type de prix présent. Le one-shot est compté en
          // quantité de lignes ; le mensuel est compté sur la DURÉE du contrat
          // (ex. 12 mois) → quantité = durée, total = prix mensuel × durée.
          const parts: Array<{
            label: string;
            orig: number;
            eff: number;
            prixSuffix: string;
            rowQte: number;
          }> = [];
          const oneOrig = p.prixOneShot ?? 0;
          const oneEff = p.prixOneShotEff ?? oneOrig;
          const mensOrig = p.prixMensuel ?? 0;
          const mensEff = p.prixMensuelEff ?? mensOrig;
          if (oneOrig > 0)
            parts.push({
              label: "Frais unique",
              orig: oneOrig,
              eff: oneEff,
              prixSuffix: "",
              rowQte: qte,
            });
          if (mensOrig > 0)
            parts.push({
              label: "Abonnement mensuel",
              orig: mensOrig,
              eff: mensEff,
              prixSuffix: " / mois",
              rowQte: duree * qte,
            });

          return (
            <View key={i} style={styles.prestaGroup}>
              {/* Nom + description en tête du groupe (sur toute la largeur) */}
              <Text style={styles.prestaNomText}>{p.nom}</Text>
              {desc ? <Text style={styles.prestaDesc}>{desc}</Text> : null}

              {parts.map((part, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={styles.colLabel}>{part.label}</Text>
                  <Text style={styles.colQte}>{part.rowQte}</Text>
                  <Text style={styles.colPrix}>
                    {fmt(part.orig)}
                    {part.prixSuffix}
                  </Text>
                  <View style={styles.colReduction}>
                    <ReductionBadge
                      orig={part.orig}
                      eff={part.eff}
                      offert={!!p.offert}
                      remiseLabel={remiseLabel}
                    />
                  </View>
                  <Text style={styles.colTotal}>{fmt(part.eff * part.rowQte)}</Text>
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.totauxBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Frais unique</Text>
            <Text style={styles.totalValue}>
              {fmt(data.montantOneShot)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Mensuel récurrent</Text>
            <Text style={styles.totalValue}>
              {fmt(data.montantMensuel)} / mois
            </Text>
          </View>
          <View style={styles.totalFinal}>
            <Text style={styles.totalFinalLabel}>
              Valeur engagée {data.dureeMois} mois
            </Text>
            <Text style={styles.totalFinalValue}>
              {fmt(data.montantOneShot + data.montantMensuel * data.dureeMois)}
            </Text>
          </View>
        </View>

        {/* Note libre du contrat (saisie dans le wizard) */}
        {data.note && data.note.trim() !== "" && (
          <View style={{ marginTop: 16 }} wrap={false}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: "#1e293b",
                marginBottom: 4,
              }}
            >
              Note
            </Text>
            <Text
              style={{ fontSize: 9, color: "#334155", lineHeight: 1.4 }}
            >
              {data.note.trim()}
            </Text>
          </View>
        )}

        <View style={styles.cgvBanner}>
          <Text>
            En signant ci-dessous, le Client confirme avoir pris connaissance
            et accepté sans réserve les Conditions Générales de Vente d&apos;ACLR
            Sàrl (version {CGV_VERSION}) annexées au présent contrat. Le
            contrat est conclu pour une durée ferme de {data.dureeMois} mois
            et se renouvelle tacitement (cf. art. 3 CGV).
          </Text>
        </View>

        {/* Bloc signatures — insécable : ne doit jamais être coupé entre 2 pages */}
        <View style={styles.signatureBlock} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureBoxLabel}>Pour le Client</Text>
            {data.signature?.signatureClientDataUrl ? (
              <Image
                src={data.signature.signatureClientDataUrl}
                style={styles.signatureImg}
              />
            ) : (
              <Text style={{ fontSize: 8, color: c.muted, marginTop: 18 }}>
                Signature à apposer
              </Text>
            )}
            {data.signature?.nomClient && (
              <Text style={styles.signatureName}>
                {data.signature.nomClient}
              </Text>
            )}
            {data.signature?.dateSignatureClient && (
              <Text style={styles.signatureMeta}>
                Signé le{" "}
                {formatDateLong(data.signature.dateSignatureClient)}
                {data.signature.ipClient
                  ? ` · IP ${data.signature.ipClient}`
                  : ""}
              </Text>
            )}
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureBoxLabel}>
              Pour ACLR Sàrl (contre-signature)
            </Text>
            {data.signature?.signeParAclr ? (
              <>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>
                  ✓ ACLR Sàrl
                </Text>
                <Text style={styles.signatureMeta}>
                  Contre-signé le{" "}
                  {data.signature.dateSignatureAclr
                    ? formatDateLong(data.signature.dateSignatureAclr)
                    : "—"}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 8, color: c.muted, marginTop: 18 }}>
                En attente de contre-signature.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {data.emetteur.raisonSociale} · Contrat {data.numero} · CGV{" "}
            {CGV_VERSION}
          </Text>
        </View>
      </Page>

      {/* Annexe : CGV intégrales */}
      <CgvPages />
    </Document>
  );
}
