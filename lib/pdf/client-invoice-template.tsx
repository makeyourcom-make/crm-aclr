/**
 * Template PDF — Facture client émise par ACLR Sàrl.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import { formatCHF, formatDateLong } from "@/lib/format";

export interface ClientInvoicePdfData {
  numero: string;
  dateEmission: Date;
  dateEcheance: Date;
  emetteur: {
    raisonSociale: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
    iban?: string;
    bicSwift?: string;
    nomBanque?: string;
    numeroIDE?: string;
    numeroTVA?: string;
  };
  client: {
    raisonSociale: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
    contactNom?: string;
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
  primary: "#1F4E78",
  border: "#E2E8F0",
  muted: "#64748B",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 9, color: "#0F172A" },
  brandBar: { height: 6, backgroundColor: c.primary, marginBottom: 24 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  partieBlock: { width: "48%" },
  partieLabel: { fontSize: 7, color: c.muted, textTransform: "uppercase", marginBottom: 4 },
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
  totauxBlock: { marginTop: 20, alignSelf: "flex-end", width: "55%", padding: 12, backgroundColor: "#F8FAFC", borderRadius: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { fontSize: 9, color: c.muted },
  totalValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totalFinal: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.primary },
  totalFinalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: c.primary },
  totalFinalValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: c.primary },
  banque: { marginTop: 20, padding: 10, backgroundColor: "#F0F6FC", borderRadius: 4, fontSize: 8 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7, color: c.muted, textAlign: "center", borderTopWidth: 0.5, borderTopColor: c.border, paddingTop: 8 },
});

export function ClientInvoicePdf({ data }: { data: ClientInvoicePdfData }) {
  return (
    <Document title={`Facture ${data.numero}`} subject={`Facture ${data.numero}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} />

        <View style={styles.parties}>
          <View style={styles.partieBlock}>
            <Text style={styles.partieLabel}>Émetteur</Text>
            <Text style={styles.partieName}>{data.emetteur.raisonSociale}</Text>
            {data.emetteur.adresse && <Text style={styles.partieLine}>{data.emetteur.adresse}</Text>}
            <Text style={styles.partieLine}>
              {[data.emetteur.codePostal, data.emetteur.ville].filter(Boolean).join(" ")}
            </Text>
            {data.emetteur.pays && <Text style={styles.partieLine}>{data.emetteur.pays}</Text>}
            {data.emetteur.numeroIDE && <Text style={styles.partieLine}>{data.emetteur.numeroIDE}</Text>}
            {data.emetteur.numeroTVA && <Text style={styles.partieLine}>{data.emetteur.numeroTVA}</Text>}
          </View>

          <View style={styles.partieBlock}>
            <Text style={styles.partieLabel}>Facturé à</Text>
            <Text style={styles.partieName}>{data.client.raisonSociale}</Text>
            {data.client.contactNom && <Text style={styles.partieLine}>{data.client.contactNom}</Text>}
            {data.client.adresse && <Text style={styles.partieLine}>{data.client.adresse}</Text>}
            <Text style={styles.partieLine}>
              {[data.client.codePostal, data.client.ville].filter(Boolean).join(" ")}
            </Text>
            {data.client.pays && <Text style={styles.partieLine}>{data.client.pays}</Text>}
          </View>
        </View>

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
        </View>

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
            <Text style={styles.colPU}>{formatCHF(l.prixUnitaire)}</Text>
            <Text style={styles.colHT}>{formatCHF(l.montantHT)}</Text>
          </View>
        ))}

        <View style={styles.totauxBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total HT</Text>
            <Text style={styles.totalValue}>{formatCHF(data.sousTotal)}</Text>
          </View>
          {data.tvaActive && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA</Text>
              <Text style={styles.totalValue}>+ {formatCHF(data.totalTVA)}</Text>
            </View>
          )}
          <View style={styles.totalFinal}>
            <Text style={styles.totalFinalLabel}>Total à payer</Text>
            <Text style={styles.totalFinalValue}>{formatCHF(data.total)}</Text>
          </View>
        </View>

        {data.emetteur.iban && (
          <View style={styles.banque}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>
              Coordonnées bancaires
            </Text>
            <Text>IBAN : {data.emetteur.iban}</Text>
            {data.emetteur.bicSwift && <Text>BIC/SWIFT : {data.emetteur.bicSwift}</Text>}
            {data.emetteur.nomBanque && <Text>Banque : {data.emetteur.nomBanque}</Text>}
            <Text style={{ marginTop: 3 }}>
              Référence à mentionner : <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.numero}</Text>
            </Text>
          </View>
        )}

        {data.notesClient && (
          <View style={{ marginTop: 12, padding: 10, backgroundColor: "#F8FAFC", fontSize: 8 }}>
            <Text>{data.notesClient}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Merci de votre confiance. Tout retard de paiement &gt; 30 jours déclenche une relance automatique.</Text>
        </View>
      </Page>
    </Document>
  );
}
