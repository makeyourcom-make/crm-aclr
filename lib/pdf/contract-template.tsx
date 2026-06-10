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
   * Liste des prestations vendues. On affiche désignation + description
   * éventuelle, SANS prix par ligne. Les prix par ligne du catalogue
   * peuvent diverger des prix réellement contractés (override à la
   * signature, MAJ catalogue post-signature) — pour éviter toute
   * contradiction visuelle avec les totaux en bas, on s'en tient au récap.
   * Détail tarifaire ligne par ligne = sur la facture (qui a un modèle
   * ClientInvoiceLine avec prix unitaire négocié figé).
   */
  produits: Array<{
    nom: string;
    description?: string | null;
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
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: c.border,
  },
  colNom: { width: "60%" },
  colOneShot: { width: "20%", textAlign: "right" },
  colMensuel: { width: "20%", textAlign: "right" },
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
  CINQUANTE_CINQUANTE: "50 % à la signature / 50 % à la livraison",
  CENT_AU_SIGNING: "100 % à la signature",
  MENSUEL: "Mensualisé sur la durée",
};

export function ContractPdf({ data }: { data: ContractPdfData }) {
  const devise = data.devise ?? "CHF";
  const fmt = (n: number | null | undefined) => formatMoney(n, devise);
  return (
    <Document
      title={`Contrat ${data.numero}`}
      subject={`Contrat ${data.numero} — ${data.client.raisonSociale}`}
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
            Date de signature : affichée UNIQUEMENT si le client a
            réellement signé le document. Sinon le PDF n'est qu'un
            projet / aperçu en attente — on affiche un placeholder.
          */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date de signature :</Text>
            <Text style={styles.metaValue}>
              {data.signature?.dateSignatureClient
                ? formatDateLong(data.signature.dateSignatureClient)
                : "— non signé —"}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date de début :</Text>
            <Text style={styles.metaValue}>
              {formatDateLong(data.dateDebut)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Durée ferme :</Text>
            <Text style={styles.metaValue}>{data.dureeMois} mois</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Modalité de paiement :</Text>
            <Text style={styles.metaValue}>
              {MODALITE_LABELS[data.modalitePaiement] ??
                data.modalitePaiement}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Prestations vendues</Text>

        {data.produits.map((p, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colNom}>
              {"• "}
              {p.nom}
              {p.description ? ` — ${p.description}` : ""}
            </Text>
          </View>
        ))}

        <View style={styles.totauxBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Frais one-shot</Text>
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
              Valeur engagée 12 mois
            </Text>
            <Text style={styles.totalFinalValue}>
              {fmt(data.valeurAn1)}
            </Text>
          </View>
        </View>

        <View style={styles.cgvBanner}>
          <Text>
            En signant ci-dessous, le Client confirme avoir pris connaissance
            et accepté sans réserve les Conditions Générales de Vente d&apos;ACLR
            Sàrl (version {CGV_VERSION}) annexées au présent contrat. Le
            contrat est conclu pour une durée ferme de {data.dureeMois} mois
            et se renouvelle tacitement (cf. art. 3 CGV).
          </Text>
        </View>

        {/* Bloc signatures */}
        <View style={styles.signatureBlock}>
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
