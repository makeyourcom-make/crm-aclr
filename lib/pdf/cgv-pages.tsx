/**
 * Composant PDF réutilisable — annexe les CGV (Conditions Générales de Vente)
 * en pages supplémentaires d'un Document @react-pdf/renderer.
 *
 * Usage :
 *   <Document>
 *     <Page>...contenu principal...</Page>
 *     <CgvPages />
 *   </Document>
 *
 * Le composant retourne une <Page> (potentiellement avec wrap automatique sur
 * plusieurs pages physiques si le texte déborde) avec mise en forme sobre.
 */
import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import { CGV_ARTICLES, CGV_TITLE, CGV_VERSION } from "@/lib/cgv";

const c = {
  primary: "#0E1936",
  muted: "#64748B",
  border: "#E2E8F0",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#0F172A",
    lineHeight: 1.4,
  },
  topBar: { height: 4, backgroundColor: c.primary, marginBottom: 18 },
  header: { marginBottom: 14 },
  title: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
    marginBottom: 2,
  },
  subtitle: { fontSize: 7.5, color: c.muted, textTransform: "uppercase" },
  article: { marginBottom: 10 },
  articleTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
    marginBottom: 4,
  },
  paragraph: {
    flexDirection: "row",
    marginBottom: 3,
  },
  paragraphId: {
    width: 24,
    fontFamily: "Helvetica-Bold",
    color: c.primary,
  },
  paragraphText: { flex: 1 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 6.5,
    color: c.muted,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: c.border,
    paddingTop: 6,
  },
});

export function CgvPages() {
  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.topBar} fixed />

      <View style={styles.header}>
        <Text style={styles.title}>{CGV_TITLE}</Text>
        <Text style={styles.subtitle}>
          Version {CGV_VERSION} · annexée au présent document
        </Text>
      </View>

      {CGV_ARTICLES.map((article) => (
        <View key={article.number} style={styles.article} wrap={false}>
          <Text style={styles.articleTitle}>
            {article.number}. {article.title}
          </Text>
          {article.paragraphs.map((p) => (
            <View key={p.id} style={styles.paragraph}>
              <Text style={styles.paragraphId}>{p.id}</Text>
              <Text style={styles.paragraphText}>{p.text}</Text>
            </View>
          ))}
        </View>
      ))}

      <Text
        style={styles.footer}
        fixed
        render={({ pageNumber, totalPages }) =>
          `ACLR Sàrl — MakeYourCom · CGV ${CGV_VERSION} · page ${pageNumber}/${totalPages}`
        }
      />
    </Page>
  );
}
