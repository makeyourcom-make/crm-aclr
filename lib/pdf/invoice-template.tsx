/**
 * Template PDF — Bulletin de salaire commercial (fiche de paye suisse).
 *
 * Aux couleurs Make Your Com, émis au nom de la raison sociale ACLR Sàrl.
 * Page 1 : bulletin (gains, cotisations, frais, montant versé).
 * Page 2 : détail du salaire brut (toutes les commissions par contrat, avec la
 * nature du versement : 1er versement / étalement / renouvellement).
 *
 * @react-pdf/renderer, A4 portrait, français.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import { formatCHF } from "@/lib/format";
import { computePayslip, payslipLineLabel } from "@/lib/salary-payslip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoicePdfData {
  numero: string;
  mois: Date;
  dateEmission: Date;

  commerciale: {
    name: string;
    email: string;
    iban?: string;
    adresse?: string;
    numeroAVS?: string;
  };

  emetteur: {
    raisonSociale: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
    iban?: string;
    numeroIDE?: string;
  };

  lignes: Array<{
    contractNumero: string;
    raisonSociale: string;
    typePart: string;
    numeroMois: number | null;
    montant: number;
  }>;

  /** Nombre de contrats distincts (déterminant du salaire de base). */
  nbContrats: number;

  montantCommissions: number;
  montantGarantieAbsorbee: number;
  montantFrais: number;
  montantTotal: number;
  garantieMensuelle: number;
}

// ---------------------------------------------------------------------------
// Couleurs Make Your Com
// ---------------------------------------------------------------------------

const c = {
  navy: "#0E1936",
  navy700: "#1B2A4E",
  coral: "#E95256",
  border: "#E2E8F0",
  muted: "#64748B",
  fg: "#0F172A",
  zebra: "#F8FAFC",
  headBg: "#F1F5F9",
  win: "#0B7A3B",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: c.fg,
  },
  brandBar: { height: 5, backgroundColor: c.navy, marginBottom: 2 },
  brandAccent: { height: 3, width: 90, backgroundColor: c.coral, marginBottom: 18 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  employer: { width: "55%" },
  employerName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: c.navy },
  brandTag: {
    fontSize: 7,
    color: c.coral,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  line: { marginBottom: 1, color: c.muted },
  docMeta: { width: "42%", textAlign: "right" },
  docTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: c.navy, marginBottom: 4 },
  metaSmall: { fontSize: 8, color: c.muted, marginBottom: 1 },

  // Bloc salarié
  employee: {
    backgroundColor: c.zebra,
    borderLeftWidth: 3,
    borderLeftColor: c.coral,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  employeeName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },

  // Tables
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: c.navy,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  thead: {
    flexDirection: "row",
    backgroundColor: c.headBg,
    paddingVertical: 5,
    paddingHorizontal: 5,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: c.muted,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 4.5,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: c.border,
  },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 5,
    backgroundColor: c.zebra,
    fontFamily: "Helvetica-Bold",
  },
  // Colonnes bulletin : GS | Texte | Déterminant | Taux/Qté | Montant
  cGs: { width: "10%" },
  cTxt: { width: "44%" },
  cDet: { width: "18%", textAlign: "right" },
  cTaux: { width: "12%", textAlign: "right" },
  cMnt: { width: "16%", textAlign: "right" },

  // Montant versé
  payBox: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: c.navy,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 4,
  },
  payLabel: { color: "#FFFFFF", fontSize: 11, fontFamily: "Helvetica-Bold" },
  payValue: { color: "#FFFFFF", fontSize: 16, fontFamily: "Helvetica-Bold" },

  ibanNote: { marginTop: 8, fontSize: 8, color: c.muted },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 7,
    color: c.muted,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: c.border,
    paddingTop: 6,
  },

  // Page 2
  cP2Ctr: { width: "16%" },
  cP2Cli: { width: "34%" },
  cP2Nat: { width: "35%" },
  cP2Mnt: { width: "15%", textAlign: "right" },

  bold: { fontFamily: "Helvetica-Bold" },
  zebraRow: { backgroundColor: c.zebra },
});

function Cell({
  style,
  children,
  bold,
}: {
  style: ReturnType<typeof StyleSheet.create>[string];
  children: React.ReactNode;
  bold?: boolean;
}) {
  return <Text style={bold ? [style, styles.bold] : style}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const moisLabel = data.mois
    .toLocaleDateString("fr-CH", { month: "long", year: "numeric", timeZone: "UTC" })
    .replace(/^(.)/, (m) => m.toUpperCase());

  const pay = computePayslip({
    baseCommission: data.montantCommissions,
    frais: data.montantFrais,
  });

  const moisDebut = new Date(
    Date.UTC(data.mois.getUTCFullYear(), data.mois.getUTCMonth(), 1),
  );
  const moisFin = new Date(
    Date.UTC(data.mois.getUTCFullYear(), data.mois.getUTCMonth() + 1, 0),
  );
  const periode = `${moisDebut.toLocaleDateString("fr-CH", { timeZone: "UTC" })} - ${moisFin.toLocaleDateString("fr-CH", { timeZone: "UTC" })}`;

  return (
    <Document
      title={`Bulletin de salaire ${data.numero}`}
      author={data.emetteur.raisonSociale}
      subject={`Bulletin de salaire ${moisLabel} - ${data.commerciale.name}`}
    >
      {/* ---------------- PAGE 1 : BULLETIN ---------------- */}
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} />
        <View style={styles.brandAccent} />

        <View style={styles.headerRow}>
          <View style={styles.employer}>
            <Text style={styles.brandTag}>Make Your Com</Text>
            <Text style={styles.employerName}>{data.emetteur.raisonSociale}</Text>
            {data.emetteur.adresse && <Text style={styles.line}>{data.emetteur.adresse}</Text>}
            <Text style={styles.line}>
              {[data.emetteur.codePostal, data.emetteur.ville].filter(Boolean).join(" ")}
            </Text>
            {data.emetteur.pays && <Text style={styles.line}>{data.emetteur.pays}</Text>}
            {data.emetteur.numeroIDE && <Text style={styles.line}>{data.emetteur.numeroIDE}</Text>}
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docTitle}>Bulletin de salaire</Text>
            <Text style={styles.metaSmall}>{moisLabel}</Text>
            <Text style={styles.metaSmall}>N° {data.numero}</Text>
            <Text style={styles.metaSmall}>
              Imprimé le {new Date().toLocaleDateString("fr-CH")} · Page 1 / 2
            </Text>
          </View>
        </View>

        {/* Salarié */}
        <View style={styles.employee}>
          <Text style={styles.employeeName}>{data.commerciale.name}</Text>
          {data.commerciale.adresse && <Text style={styles.line}>{data.commerciale.adresse}</Text>}
          {data.commerciale.numeroAVS && (
            <Text style={styles.line}>Numéro assurance sociale : {data.commerciale.numeroAVS}</Text>
          )}
          <Text style={styles.line}>Période de salaire : {periode}</Text>
        </View>

        {/* Gains */}
        <View style={styles.thead}>
          <Cell style={styles.cGs}>GS</Cell>
          <Cell style={styles.cTxt}>Texte</Cell>
          <Cell style={styles.cDet}>Déterminant</Cell>
          <Cell style={styles.cTaux}>Taux/Qté</Cell>
          <Cell style={styles.cMnt}>Brut</Cell>
        </View>
        <View style={styles.row}>
          <Cell style={styles.cGs}>1000</Cell>
          <Cell style={styles.cTxt}>Salaire de base (commissions du mois)</Cell>
          <Cell style={styles.cDet}>{data.nbContrats} contrat{data.nbContrats > 1 ? "s" : ""}</Cell>
          <Cell style={styles.cTaux}>-</Cell>
          <Cell style={styles.cMnt}>{formatCHF(pay.base)}</Cell>
        </View>
        <View style={styles.row}>
          <Cell style={styles.cGs}>1200</Cell>
          <Cell style={styles.cTxt}>Indemnité vacances</Cell>
          <Cell style={styles.cDet}>{pay.base.toFixed(2)}</Cell>
          <Cell style={styles.cTaux}>8.33 %</Cell>
          <Cell style={styles.cMnt}>{formatCHF(pay.indemniteVacances)}</Cell>
        </View>
        <View style={styles.row}>
          <Cell style={styles.cGs}>1210</Cell>
          <Cell style={styles.cTxt}>Indemnité jours fériés</Cell>
          <Cell style={styles.cDet}>{pay.base.toFixed(2)}</Cell>
          <Cell style={styles.cTaux}>3.00 %</Cell>
          <Cell style={styles.cMnt}>{formatCHF(pay.indemniteFeries)}</Cell>
        </View>
        <View style={styles.totalRow}>
          <Cell style={styles.cGs}> </Cell>
          <Cell style={styles.cTxt} bold>Total brut</Cell>
          <Cell style={styles.cDet}> </Cell>
          <Cell style={styles.cTaux}> </Cell>
          <Cell style={styles.cMnt} bold>{formatCHF(pay.brut)}</Cell>
        </View>

        {/* Déductions */}
        <Text style={styles.sectionTitle}>Déductions</Text>
        <View style={styles.thead}>
          <Cell style={styles.cGs}>GS</Cell>
          <Cell style={styles.cTxt}>Cotisations &amp; retenues</Cell>
          <Cell style={styles.cDet}>Déterminant</Cell>
          <Cell style={styles.cTaux}>Taux</Cell>
          <Cell style={styles.cMnt}>Valeur</Cell>
        </View>
        {[
          { gs: "5010", l: pay.deductions[0] },
          { gs: "5011", l: pay.deductions[1] },
          { gs: "5020", l: pay.deductions[2] },
          { gs: "5060", l: pay.deductions[3] },
        ].map((d) => (
          <View key={d.gs} style={styles.row}>
            <Cell style={styles.cGs}>{d.gs}</Cell>
            <Cell style={styles.cTxt}>{d.l.label}</Cell>
            <Cell style={styles.cDet}>{d.l.determinant}</Cell>
            <Cell style={styles.cTaux}>{d.l.taux} %</Cell>
            <Cell style={styles.cMnt}>{formatCHF(d.l.montant)}</Cell>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Cell style={styles.cGs}> </Cell>
          <Cell style={styles.cTxt} bold>Total déductions</Cell>
          <Cell style={styles.cDet}> </Cell>
          <Cell style={styles.cTaux}> </Cell>
          <Cell style={styles.cMnt} bold>{formatCHF(-pay.totalDeductions)}</Cell>
        </View>

        {/* Remboursements / frais */}
        {pay.frais > 0 && (
          <>
            <Text style={styles.sectionTitle}>Remboursements et frais</Text>
            <View style={styles.row}>
              <Cell style={styles.cGs}>5900</Cell>
              <Cell style={styles.cTxt}>Frais de déplacement (forfait, non soumis aux cotisations)</Cell>
              <Cell style={styles.cDet}>forfait</Cell>
              <Cell style={styles.cTaux}>-</Cell>
              <Cell style={styles.cMnt}>+ {formatCHF(pay.frais)}</Cell>
            </View>
          </>
        )}

        {/* Montant versé */}
        <View style={styles.payBox}>
          <Text style={styles.payLabel}>Montant versé</Text>
          <Text style={styles.payValue}>{formatCHF(pay.montantVerse)}</Text>
        </View>
        {data.commerciale.iban && (
          <Text style={styles.ibanNote}>Versement sur IBAN : {data.commerciale.iban}</Text>
        )}

        <View style={styles.footer}>
          <Text>
            {data.emetteur.raisonSociale} · Bulletin de salaire généré par le CRM Make Your Com ·
            Salaire de base = commissions dues le mois (détail en page 2).
          </Text>
        </View>
      </Page>

      {/* ---------------- PAGE 2 : DÉTAIL DU SALAIRE BRUT ---------------- */}
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} />
        <View style={styles.brandAccent} />

        <View style={styles.headerRow}>
          <View style={styles.employer}>
            <Text style={styles.brandTag}>Make Your Com</Text>
            <Text style={styles.employerName}>{data.emetteur.raisonSociale}</Text>
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docTitle}>Détail du salaire de base</Text>
            <Text style={styles.metaSmall}>{data.commerciale.name} · {moisLabel}</Text>
            <Text style={styles.metaSmall}>N° {data.numero} · Page 2 / 2</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Commissions du mois ({data.lignes.length} versement{data.lignes.length > 1 ? "s" : ""} · {data.nbContrats} contrat{data.nbContrats > 1 ? "s" : ""})
        </Text>
        <View style={styles.thead}>
          <Cell style={styles.cP2Ctr}>Contrat</Cell>
          <Cell style={styles.cP2Cli}>Client</Cell>
          <Cell style={styles.cP2Nat}>Nature du versement</Cell>
          <Cell style={styles.cP2Mnt}>Montant</Cell>
        </View>
        {data.lignes.length === 0 ? (
          <View style={styles.row}>
            <Text style={{ width: "100%", textAlign: "center", color: c.muted }}>
              Aucune commission ce mois.
            </Text>
          </View>
        ) : (
          data.lignes.map((l, i) => (
            <View key={i} style={i % 2 === 1 ? [styles.row, styles.zebraRow] : styles.row}>
              <Cell style={styles.cP2Ctr}>{l.contractNumero}</Cell>
              <Cell style={styles.cP2Cli}>{l.raisonSociale}</Cell>
              <Cell style={styles.cP2Nat}>{payslipLineLabel(l.typePart, l.numeroMois)}</Cell>
              <Cell style={styles.cP2Mnt}>{formatCHF(l.montant)}</Cell>
            </View>
          ))
        )}
        <View style={styles.totalRow}>
          <Cell style={styles.cP2Ctr}> </Cell>
          <Cell style={styles.cP2Cli}> </Cell>
          <Cell style={styles.cP2Nat} bold>Total salaire de base (prime)</Cell>
          <Cell style={styles.cP2Mnt} bold>{formatCHF(pay.base)}</Cell>
        </View>

        <View style={{ marginTop: 14, padding: 10, backgroundColor: c.zebra, borderRadius: 4 }}>
          <Text style={{ fontSize: 8, color: c.muted, lineHeight: 1.5 }}>
            Rappel des versements : la commission de signature (25 % de la valeur du contrat, budget
            publicitaire exclu) se verse pour moitié à la signature (« 1er versement »), l&apos;autre
            moitié étant étalée sur les mois restants du contrat (« étalement »). Après le terme, le
            renouvellement est rémunéré à 10 % du mensuel récurrent.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>
            {data.emetteur.raisonSociale} · Make Your Com · Détail des commissions du bulletin {data.numero}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
