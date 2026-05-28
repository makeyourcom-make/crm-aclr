/**
 * Template PDF — Facture mensuelle Sophie → Arthur.
 *
 * Utilise @react-pdf/renderer pour générer un PDF côté serveur.
 * Style sobre, A4 portrait, en français.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import { formatCHF, formatDateLong } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoicePdfData {
  /** N° facture (SOPHIE-2026-XX) */
  numero: string;
  /** Date du mois facturé (1er du mois) */
  mois: Date;
  /** Date de génération (= createdAt) */
  dateEmission: Date;

  /** Coords commerciale (haut gauche) */
  commerciale: {
    name: string;
    email: string;
    iban?: string;
  };

  /** Coords ACLR (haut droite) */
  emetteur: {
    raisonSociale: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
    iban?: string;
    numeroIDE?: string;
  };

  /** Lignes du détail */
  lignes: Array<{
    contractNumero: string;
    raisonSociale: string;
    typePart: string;
    numeroMois: number | null;
    montant: number;
  }>;

  /** Montants */
  montantCommissions: number;
  montantGarantieAbsorbee: number;
  montantFrais: number;
  montantTotal: number;
  garantieMensuelle: number;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const c = {
  primary: "#1F4E78",
  border: "#E2E8F0",
  muted: "#64748B",
  fgDark: "#0F172A",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: c.fgDark,
  },

  // Header bandeau
  brandBar: {
    height: 6,
    backgroundColor: c.primary,
    marginBottom: 24,
  },

  // Bloc émetteur / destinataire en 2 colonnes
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  partieBlock: { width: "48%" },
  partieLabel: {
    fontSize: 7,
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  partieName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  partieLine: { marginBottom: 1 },

  // Titre & méta
  titreFacture: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  metaLabel: {
    color: c.muted,
    width: 110,
    fontSize: 8,
  },
  metaValue: { fontSize: 9 },

  // Table des lignes
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
  colContrat: { width: "20%" },
  colClient: { width: "32%" },
  colType: { width: "20%" },
  colMois: { width: "10%", textAlign: "center" },
  colMontant: { width: "18%", textAlign: "right" },

  // Section totaux
  totauxBlock: {
    marginTop: 20,
    alignSelf: "flex-end",
    width: "55%",
    backgroundColor: "#F8FAFC",
    padding: 12,
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

  // Footer
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

  // Notes garantie
  garantieNote: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 4,
    fontSize: 8,
    color: "#92400E",
  },
});

const TYPE_PART_LABEL: Record<string, string> = {
  SIGNATURE: "Signature",
  ETALEMENT: "Étalement",
  RENOUVELLEMENT: "Renouvellement",
};

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const moisLabel = data.mois.toLocaleDateString("fr-CH", {
    month: "long",
    year: "numeric",
  });
  const garantieActivee = data.montantGarantieAbsorbee > 0;

  return (
    <Document
      title={`Facture ${data.numero}`}
      author={data.commerciale.name}
      subject={`Facture mensuelle ${moisLabel}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} />

        {/* Parties */}
        <View style={styles.parties}>
          {/* De (commerciale) */}
          <View style={styles.partieBlock}>
            <Text style={styles.partieLabel}>De</Text>
            <Text style={styles.partieName}>{data.commerciale.name}</Text>
            <Text style={styles.partieLine}>{data.commerciale.email}</Text>
            {data.commerciale.iban && (
              <Text style={styles.partieLine}>IBAN : {data.commerciale.iban}</Text>
            )}
          </View>

          {/* À (ACLR) */}
          <View style={styles.partieBlock}>
            <Text style={styles.partieLabel}>Facturé à</Text>
            <Text style={styles.partieName}>{data.emetteur.raisonSociale}</Text>
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
          </View>
        </View>

        {/* Titre + méta */}
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.titreFacture}>Facture de commissions</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>N° facture :</Text>
            <Text style={styles.metaValue}>{data.numero}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Mois facturé :</Text>
            <Text style={styles.metaValue}>{moisLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date d&apos;émission :</Text>
            <Text style={styles.metaValue}>
              {formatDateLong(data.dateEmission)}
            </Text>
          </View>
        </View>

        {/* Table des commissions */}
        <View style={styles.tableHeader}>
          <Text style={styles.colContrat}>Contrat</Text>
          <Text style={styles.colClient}>Client</Text>
          <Text style={styles.colType}>Type</Text>
          <Text style={styles.colMois}>Mois</Text>
          <Text style={styles.colMontant}>Montant</Text>
        </View>

        {data.lignes.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={{ width: "100%", textAlign: "center", color: c.muted }}>
              Aucune commission acquise ce mois.
            </Text>
          </View>
        ) : (
          data.lignes.map((l, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colContrat}>{l.contractNumero}</Text>
              <Text style={styles.colClient}>{l.raisonSociale}</Text>
              <Text style={styles.colType}>
                {TYPE_PART_LABEL[l.typePart] ?? l.typePart}
              </Text>
              <Text style={styles.colMois}>{l.numeroMois ?? "-"}</Text>
              <Text style={styles.colMontant}>{formatCHF(l.montant)}</Text>
            </View>
          ))
        )}

        {/* Totaux */}
        <View style={styles.totauxBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Sous-total commissions ({data.lignes.length} versement·s)
            </Text>
            <Text style={styles.totalValue}>
              {formatCHF(data.montantCommissions)}
            </Text>
          </View>

          {garantieActivee && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Garantie absorbée</Text>
              <Text style={styles.totalValue}>
                + {formatCHF(data.montantGarantieAbsorbee)}
              </Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Forfait frais</Text>
            <Text style={styles.totalValue}>
              + {formatCHF(data.montantFrais)}
            </Text>
          </View>

          <View style={styles.totalFinal}>
            <Text style={styles.totalFinalLabel}>Total à verser</Text>
            <Text style={styles.totalFinalValue}>
              {formatCHF(data.montantTotal)}
            </Text>
          </View>
        </View>

        {/* Note garantie si activée */}
        {garantieActivee && (
          <View style={styles.garantieNote}>
            <Text>
              ⓘ La garantie absorbée ({formatCHF(data.montantGarantieAbsorbee)}) a
              complété les commissions de ce mois ({formatCHF(data.montantCommissions)})
              pour atteindre le minimum garanti ({formatCHF(data.garantieMensuelle)}).
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Facture générée automatiquement par le CRM Make Your Com — Merci de
            verser le total sur l&apos;IBAN ci-dessus.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
