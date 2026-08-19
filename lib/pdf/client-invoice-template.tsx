/**
 * Template PDF — Facture client émise par ACLR Sàrl.
 *
 * Particularités :
 *   - Logo "MAKE YOUR COM" rendu en texte stylisé en haut (pas d'image).
 *   - Détection devise via `data.currency` ("CHF" | "EUR").
 *   - Bloc bancaire approprié au footer (CHF avec QR-IBAN ou EUR avec IBAN/BIC).
 *   - La QR-facture suisse (compliante Swiss QR-bill) est attachée en page
 *     séparée par la route /api/factures-clients/[id]/pdf via swissqrbill +
 *     pdf-lib quand devise = CHF.
 */
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

import { CgvPages } from "@/lib/pdf/cgv-pages";
import { formatCHF, formatDateLong } from "@/lib/format";

export interface ClientInvoicePdfData {
  numero: string;
  dateEmission: Date;
  dateEcheance: Date;
  /** Devise du montant. CHF = ajoute QR-facture suisse, EUR = bloc EUR. */
  currency?: "CHF" | "EUR";
  emetteur: {
    raisonSociale: string;
    marque?: string; // "Make Your Com"
    adresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
    iban?: string; // CHF
    bicSwift?: string;
    nomBanque?: string;
    ibanEUR?: string;
    bicSwiftEUR?: string;
    numeroIDE?: string;
    numeroTVA?: string;
    emailContact?: string;
    siteWeb?: string;
    /**
     * Source du logo carré pour @react-pdf : data URL base64 (recommandé,
     * portable Windows/Linux) ou chemin disque.
     */
    logoPath?: string;
    /**
     * Bannière pleine largeur (data URL base64) affichée tout en haut, bord
     * à bord. Prioritaire sur `logoPath` / le bandeau navy.
     */
    bannerPath?: string;
    /** Hauteur en points de la bannière à pleine largeur A4 (calc. côté serveur). */
    bannerHeightPt?: number;
  };
  client: {
    raisonSociale: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    canton?: string;
    pays?: string;
    contactNom?: string;
    contactFonction?: string;
    email?: string;
    telephone?: string;
    numeroIDE?: string;
    numeroTVA?: string;
  };
  lignes: Array<{
    designation: string;
    quantite: number;
    prixUnitaire: number;
    montantHT: number;
  }>;
  sousTotal: number;
  totalTVA: number;
  total: number;
  notesClient?: string;
  tvaActive: boolean;
}

const c = {
  primary: "#0E1936",
  /** Couleur exacte extraite du fond du logo PNG (Make Your Com) */
  logoBg: "#070F33",
  accent: "#F87171", // coral
  border: "#E2E8F0",
  muted: "#64748B",
};

/** Largeur page A4 en points (page.padding = 0 → bannière full-bleed sans marge). */
const PAGE_WIDTH = 595.28;

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: "Helvetica", fontSize: 9, color: "#0F172A" },
  pageInner: { paddingHorizontal: 40, paddingTop: 20, paddingBottom: 40 },

  // En-tête : bandeau navy plein (couleur EXACTE du logo), logo à gauche,
  // identité ACLR en blanc à droite
  header: {
    backgroundColor: c.logoBg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 18,
    marginBottom: 28,
  },
  logoImage: {
    width: 160,
    height: 160,
    objectFit: "contain",
  },
  logoBlock: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  logoMake: {
    fontFamily: "Times-Bold",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: 1.5,
  },
  logoYour: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 2.5,
    marginTop: 2,
    textAlign: "center",
  },
  logoCom: { color: c.accent, fontFamily: "Helvetica-Bold" },
  emetteurInline: { textAlign: "right", fontSize: 9, color: "#FFFFFF" },
  emetteurName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  emetteurLine: { color: "#E0E7FF", marginBottom: 1 },
  emetteurId: { color: "#A5B4FC", fontSize: 8, marginTop: 4 },

  // Variante bannière : identité émetteur sous la bannière, texte foncé sur blanc
  bannerImage: { width: PAGE_WIDTH },
  emetteurUnderBanner: {
    paddingHorizontal: 40,
    paddingTop: 12,
    marginBottom: 20,
    alignItems: "flex-end",
    textAlign: "right",
    fontSize: 9,
  },
  emetteurNameDark: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
    marginBottom: 3,
  },
  emetteurLineDark: { color: "#334155", marginBottom: 1 },
  emetteurIdDark: { color: c.muted, fontSize: 8, marginTop: 3 },

  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  partieBlock: { width: "48%" },
  partieLabel: {
    fontSize: 7,
    color: c.muted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  partieName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  partieLine: { marginBottom: 1 },

  titre: { fontSize: 18, fontFamily: "Helvetica-Bold", color: c.primary, marginBottom: 4 },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { color: c.muted, width: 110, fontSize: 8 },
  metaValue: { fontSize: 9 },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 16,
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
  colDesign: { width: "52%" },
  colQte: { width: "12%", textAlign: "center" },
  colPU: { width: "18%", textAlign: "right" },
  colHT: { width: "18%", textAlign: "right" },

  totauxBlock: {
    marginTop: 20,
    alignSelf: "flex-end",
    width: "55%",
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
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
  totalFinalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: c.primary },
  totalFinalValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: c.primary },

  banque: {
    marginTop: 18,
    padding: 12,
    backgroundColor: "#F0F6FC",
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    borderRadius: 4,
    fontSize: 9,
  },
  banqueTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 6, color: c.primary },
  banqueRow: { flexDirection: "row", marginBottom: 2 },
  banqueLabel: { color: c.muted, width: 90, fontSize: 8 },
  banqueValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  banqueNote: { fontSize: 8, color: c.muted, marginTop: 6, fontStyle: "italic" },

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

function formatAmount(amount: number, currency: "CHF" | "EUR"): string {
  if (currency === "EUR") {
    return new Intl.NumberFormat("fr-CH", {
      style: "currency",
      currency: "EUR",
      currencyDisplay: "symbol",
    }).format(amount);
  }
  return formatCHF(amount);
}

export function ClientInvoicePdf({ data }: { data: ClientInvoicePdfData }) {
  const currency = data.currency ?? "CHF";
  const isCHF = currency === "CHF";
  const isEUR = currency === "EUR";

  return (
    <Document title={`Facture ${data.numero}`} subject={`Facture ${data.numero}`}>
      <Page size="A4" style={styles.page}>
        {/*
          En-tête. Priorité :
            1. Bannière pleine largeur (bord à bord) + identité ACLR en
               texte foncé juste en dessous (légalement requise sur facture).
            2. Repli : bandeau navy historique (logo/texte à gauche + identité
               blanche à droite).
        */}
        {data.emetteur.bannerPath ? (
          <>
            <Image
              src={data.emetteur.bannerPath}
              style={[
                styles.bannerImage,
                data.emetteur.bannerHeightPt
                  ? { height: data.emetteur.bannerHeightPt }
                  : {},
              ]}
            />
            <View style={styles.emetteurUnderBanner}>
              <Text style={styles.emetteurNameDark}>
                {data.emetteur.raisonSociale}
              </Text>
              {data.emetteur.adresse && (
                <Text style={styles.emetteurLineDark}>
                  {data.emetteur.adresse}
                </Text>
              )}
              <Text style={styles.emetteurLineDark}>
                {[data.emetteur.codePostal, data.emetteur.ville]
                  .filter(Boolean)
                  .join(" ")}
              </Text>
              {data.emetteur.pays && (
                <Text style={styles.emetteurLineDark}>{data.emetteur.pays}</Text>
              )}
              {(data.emetteur.numeroIDE || data.emetteur.numeroTVA) && (
                <Text style={styles.emetteurIdDark}>
                  {[data.emetteur.numeroIDE, data.emetteur.numeroTVA]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              )}
              {data.emetteur.emailContact && (
                <Text style={styles.emetteurIdDark}>
                  {data.emetteur.emailContact}
                </Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.header}>
            {data.emetteur.logoPath ? (
              <Image src={data.emetteur.logoPath} style={styles.logoImage} />
            ) : (
              <View style={styles.logoBlock}>
                <Text style={styles.logoMake}>MAKE</Text>
                <Text style={styles.logoYour}>
                  YOUR <Text style={styles.logoCom}>COM</Text>
                </Text>
              </View>
            )}
            <View style={styles.emetteurInline}>
              <Text style={styles.emetteurName}>
                {data.emetteur.raisonSociale}
              </Text>
              {data.emetteur.adresse && (
                <Text style={styles.emetteurLine}>{data.emetteur.adresse}</Text>
              )}
              <Text style={styles.emetteurLine}>
                {[data.emetteur.codePostal, data.emetteur.ville]
                  .filter(Boolean)
                  .join(" ")}
              </Text>
              {data.emetteur.pays && (
                <Text style={styles.emetteurLine}>{data.emetteur.pays}</Text>
              )}
              {data.emetteur.numeroIDE && (
                <Text style={styles.emetteurId}>{data.emetteur.numeroIDE}</Text>
              )}
              {data.emetteur.numeroTVA && (
                <Text style={styles.emetteurId}>{data.emetteur.numeroTVA}</Text>
              )}
              {data.emetteur.emailContact && (
                <Text style={styles.emetteurId}>
                  {data.emetteur.emailContact}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.pageInner}>
        {/* Parties : facturé à uniquement (émetteur déjà en haut) */}
        <View style={styles.parties}>
          <View>
            <Text style={styles.titre}>Facture</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>N° facture :</Text>
              <Text style={styles.metaValue}>{data.numero}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date d&apos;émission :</Text>
              <Text style={styles.metaValue}>{formatDateLong(data.dateEmission)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date d&apos;échéance :</Text>
              <Text style={styles.metaValue}>{formatDateLong(data.dateEcheance)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Devise :</Text>
              <Text style={styles.metaValue}>{currency}</Text>
            </View>
          </View>

          <View style={[styles.partieBlock, { textAlign: "right" }]}>
            <Text style={styles.partieLabel}>Facturé à</Text>
            <Text style={styles.partieName}>{data.client.raisonSociale}</Text>
            {data.client.contactNom && (
              <Text style={styles.partieLine}>{data.client.contactNom}</Text>
            )}
            {data.client.contactFonction && (
              <Text style={[styles.partieLine, { fontSize: 8, color: c.muted }]}>
                {data.client.contactFonction}
              </Text>
            )}
            {data.client.adresse && (
              <Text style={styles.partieLine}>{data.client.adresse}</Text>
            )}
            {(data.client.codePostal || data.client.ville) && (
              <Text style={styles.partieLine}>
                {[data.client.codePostal, data.client.ville].filter(Boolean).join(" ")}
                {data.client.canton ? ` (${data.client.canton})` : ""}
              </Text>
            )}
            {data.client.pays && (
              <Text style={styles.partieLine}>{data.client.pays}</Text>
            )}
            {data.client.numeroIDE && (
              <Text style={[styles.partieLine, { fontSize: 8, marginTop: 3 }]}>
                {data.client.numeroIDE}
              </Text>
            )}
            {data.client.numeroTVA && (
              <Text style={[styles.partieLine, { fontSize: 8 }]}>
                {data.client.numeroTVA}
              </Text>
            )}
            {data.client.email && (
              <Text style={[styles.partieLine, { fontSize: 8, color: c.muted, marginTop: 2 }]}>
                {data.client.email}
              </Text>
            )}
            {data.client.telephone && (
              <Text style={[styles.partieLine, { fontSize: 8, color: c.muted }]}>
                {data.client.telephone}
              </Text>
            )}
          </View>
        </View>

        {/* Lignes */}
        <View style={styles.tableHeader}>
          <Text style={styles.colDesign}>Désignation</Text>
          <Text style={styles.colQte}>Qté</Text>
          <Text style={styles.colPU}>P.U.</Text>
          <Text style={styles.colHT}>Montant HT</Text>
        </View>
        {data.lignes.map((l, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colDesign}>{l.designation}</Text>
            <Text style={styles.colQte}>{l.quantite}</Text>
            <Text style={styles.colPU}>{formatAmount(l.prixUnitaire, currency)}</Text>
            <Text style={styles.colHT}>{formatAmount(l.montantHT, currency)}</Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={styles.totauxBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total HT</Text>
            <Text style={styles.totalValue}>{formatAmount(data.sousTotal, currency)}</Text>
          </View>
          {data.tvaActive && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA</Text>
              <Text style={styles.totalValue}>+ {formatAmount(data.totalTVA, currency)}</Text>
            </View>
          )}
          <View style={styles.totalFinal}>
            <Text style={styles.totalFinalLabel}>Total à payer</Text>
            <Text style={styles.totalFinalValue}>{formatAmount(data.total, currency)}</Text>
          </View>
        </View>

        {/* Bloc bancaire — CHF ou EUR selon devise */}
        {isCHF && data.emetteur.iban && (
          <View style={styles.banque}>
            <Text style={styles.banqueTitle}>Coordonnées bancaires - paiement en CHF</Text>
            <View style={styles.banqueRow}>
              <Text style={styles.banqueLabel}>Bénéficiaire :</Text>
              <Text style={styles.banqueValue}>{data.emetteur.raisonSociale}</Text>
            </View>
            <View style={styles.banqueRow}>
              <Text style={styles.banqueLabel}>IBAN :</Text>
              <Text style={styles.banqueValue}>{data.emetteur.iban}</Text>
            </View>
            {data.emetteur.bicSwift && (
              <View style={styles.banqueRow}>
                <Text style={styles.banqueLabel}>BIC / SWIFT :</Text>
                <Text style={styles.banqueValue}>{data.emetteur.bicSwift}</Text>
              </View>
            )}
            {data.emetteur.nomBanque && (
              <View style={styles.banqueRow}>
                <Text style={styles.banqueLabel}>Banque :</Text>
                <Text style={styles.banqueValue}>{data.emetteur.nomBanque}</Text>
              </View>
            )}
            <View style={styles.banqueRow}>
              <Text style={styles.banqueLabel}>Référence :</Text>
              <Text style={styles.banqueValue}>{data.numero}</Text>
            </View>
            <Text style={styles.banqueNote}>
              ☞ QR-facture suisse compliante en page suivante (scan via bancaire mobile).
              Conditions Générales de Vente annexées ci-après.
            </Text>
          </View>
        )}

        {isEUR && data.emetteur.ibanEUR && (
          <View style={styles.banque}>
            <Text style={styles.banqueTitle}>Coordonnées bancaires - paiement en EUR</Text>
            <View style={styles.banqueRow}>
              <Text style={styles.banqueLabel}>Titulaire :</Text>
              <Text style={styles.banqueValue}>{data.emetteur.raisonSociale}</Text>
            </View>
            <View style={styles.banqueRow}>
              <Text style={styles.banqueLabel}>IBAN (EUR) :</Text>
              <Text style={styles.banqueValue}>{data.emetteur.ibanEUR}</Text>
            </View>
            <View style={styles.banqueRow}>
              <Text style={styles.banqueLabel}>BIC / SWIFT :</Text>
              <Text style={styles.banqueValue}>
                {data.emetteur.bicSwiftEUR ?? data.emetteur.bicSwift ?? "—"}
              </Text>
            </View>
            {data.emetteur.nomBanque && (
              <View style={styles.banqueRow}>
                <Text style={styles.banqueLabel}>Banque :</Text>
                <Text style={styles.banqueValue}>{data.emetteur.nomBanque}</Text>
              </View>
            )}
            <View style={styles.banqueRow}>
              <Text style={styles.banqueLabel}>Référence :</Text>
              <Text style={styles.banqueValue}>{data.numero}</Text>
            </View>
            <Text style={styles.banqueNote}>
              ☞ Compte EUR multi-devises chez UBS Switzerland. Pas de frais de
              change si le donneur d&apos;ordre paie en EUR.
            </Text>
          </View>
        )}

        {/*
          notesClient est intentionnellement RETIRÉ du PDF client :
          historiquement il contient des métadonnées internes ACLR
          (dates de paiement, refs croisées, debug, brouillons Gmail).
          Ces infos n'ont rien à faire sur le document remis au client.
          Le champ reste en DB pour traçabilité comptable côté ACLR.
        */}

        </View>{/* fin pageInner */}

        <View style={styles.footer}>
          <Text>
            Merci de votre confiance. Conditions Générales de Vente annexées
            ci-après. Tout retard de paiement &gt; 30 jours déclenche une
            relance automatique.
          </Text>
        </View>
      </Page>

      {/* Annexe : Conditions Générales de Vente */}
      <CgvPages />
    </Document>
  );
}
