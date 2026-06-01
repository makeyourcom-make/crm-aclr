/**
 * Conditions Générales de Vente — ACLR Sàrl (MakeYourCom) — version 2026.
 *
 * Single source of truth. Toute modification ici se propage automatiquement à :
 *   - La page publique de signature (/sign/{token})
 *   - Le PDF du contrat (annexé en dernière page)
 *   - Le PDF des factures clients (annexé en dernière page)
 *
 * En cas de modification, BUMP `CGV_VERSION` (utilisée pour la traçabilité
 * juridique : on saura quelle version le client a acceptée).
 */

export const CGV_VERSION = "2026.1";
export const CGV_TITLE =
  "Conditions Générales de Vente — ACLR Sàrl (MakeYourCom)";

export interface CgvArticle {
  /** Numéro d'article (ex: "1", "2", "10"). */
  number: string;
  /** Titre de l'article. */
  title: string;
  /** Paragraphes — chaque entrée = un alinéa avec sa numérotation. */
  paragraphs: Array<{ id: string; text: string }>;
}

export const CGV_ARTICLES: CgvArticle[] = [
  {
    number: "1",
    title: "Parties, champ d'application et opposabilité",
    paragraphs: [
      {
        id: "1.1",
        text: "Les présentes Conditions Générales de Vente (« CGV ») régissent l'intégralité des relations contractuelles entre la société ACLR Sàrl (ci-après « ACLR Sàrl ») et son client (ci-après « le Client »).",
      },
      {
        id: "1.2",
        text: "Les CGV forment partie intégrante du contrat conclu. Les conditions générales du Client sont totalement inapplicables, même si ce dernier y fait référence.",
      },
      {
        id: "1.3",
        text: "En cas de contradiction entre les documents contractuels, l'ordre de priorité suivant s'applique : (i) le contrat / bon de commande signé, (ii) les présentes CGV, (iii) les descriptifs de produits en ligne.",
      },
      {
        id: "1.4",
        text: "ACLR Sàrl est en droit de modifier en tout temps les CGV. Lors de chaque paiement de facture ou commande de nouvelle prestation, le Client confirme avoir pris connaissance et accepté les CGV en vigueur.",
      },
    ],
  },
  {
    number: "2",
    title: "Vente terrain, conclusion du contrat et droit de veto",
    paragraphs: [
      {
        id: "2.1",
        text: "Le contrat est réputé fermement conclu dès l'acceptation de l'offre par le Client. Cette acceptation est matérialisée par signature manuscrite sur support papier, par signature électronique sur l'écran de vente mobile (tablette/smartphone) du représentant commercial d'ACLR Sàrl, ou par tout acte concluant (paiement d'acompte, transmission d'accès).",
      },
      {
        id: "2.2",
        text: "Engagement sur la valeur totale : Dès signature, le Client est engagé de manière irrévocable sur la valeur totale et globale des prestations mentionnées sur le bon de commande.",
      },
      {
        id: "2.3",
        text: "Droit de veto d'ACLR Sàrl : Après examen des données du Client par la direction, ACLR Sàrl se réserve le droit, dans les trente (30) jours suivant la signature, de se départir du contrat sans indication de motifs et sans aucun dédommagement en faveur du Client (notamment pour des raisons d'insolvabilité ou d'impossibilité technique).",
      },
    ],
  },
  {
    number: "3",
    title: "Durée, renouvellement et interdiction de résiliation anticipée",
    paragraphs: [
      {
        id: "3.1",
        text: "Sauf mention contraire écrite sur le bon de commande, les contrats sont conclus pour une durée minimale ferme de douze (12) mois à compter de la date d'activation (mise en ligne ou livraison de la prestation).",
      },
      {
        id: "3.2",
        text: "Le contrat se renouvelle automatiquement d'année en année, sauf résiliation notifiée par écrit (courrier recommandé ou formulaire officiel) au moins trente (30) jours avant l'expiration de la période en cours.",
      },
      {
        id: "3.3",
        text: "Exclusion du droit de révocation : S'agissant de contrats entre professionnels (B2B), l'application des dispositions légales relatives à la résiliation anticipée ordinaire (notamment l'art. 377 du Code des obligations suisse) est expressément exclue. La rémunération totale reste due jusqu'au terme du contrat.",
      },
      {
        id: "3.4",
        text: "Cessation d'activité : L'éventuelle cessation d'activité, faillite, fermeture ou vente de l'entreprise du Client n'autorise pas ce dernier à résilier le contrat de manière anticipée. La valeur totale restante du contrat devient immédiatement exigible et sera facturée sous forme de solde final.",
      },
    ],
  },
  {
    number: "4",
    title: "Obligations de collaboration du Client et « Facturation Immédiate »",
    paragraphs: [
      {
        id: "4.1",
        text: "ACLR Sàrl dépend de la collaboration active du Client pour exécuter ses prestations (fourniture de logos, textes, images, codes d'accès). Le Client s'engage à exécuter ses obligations de collaboration de manière correcte et dans les délais fixés.",
      },
      {
        id: "4.2",
        text: "Si ACLR Sàrl ne peut pas mettre en ligne, activer ou publier le produit en temps utile en raison du retard ou du manque de collaboration du Client, ACLR Sàrl est en droit de facturer immédiatement l'intégralité de la rémunération totale du contrat. Dans ce cas, le Client ne peut prétendre à aucune réduction ni remboursement.",
      },
    ],
  },
  {
    number: "5",
    title: "Tarifs, facturation, rappels et Factoring",
    paragraphs: [
      {
        id: "5.1",
        text: "Les prix s'entendent nets, hors taxe sur la valeur ajoutée (TVA) en sus. Sauf accord écrit, les frais uniques (création, dossier) sont facturés dès la conclusion du contrat, et les abonnements dès l'activation.",
      },
      {
        id: "5.2",
        text: "Les factures doivent être payées sans déduction dans les trente (30) jours suivant leur établissement. À défaut d'opposition écrite dans ce délai, la facture est réputée acceptée.",
      },
      {
        id: "5.3",
        text: "En l'absence de paiement à l'échéance, le Client tombe en demeure automatique sans rappel nécessaire. Il est redevable de l'intérêt moratoire légal et de frais de rappel fixes : CHF 15.– pour le premier rappel et CHF 25.– pour le deuxième rappel.",
      },
      {
        id: "5.4",
        text: "Factoring et Recouvrement : ACLR Sàrl est expressément autorisée à céder ses créances à des tiers (sociétés de recouvrement ou banques de factoring). En cas de cession de la créance à des fins de recouvrement, des frais de dossier de CHF 75.– sont mis à la charge exclusive du Client.",
      },
      {
        id: "5.5",
        text: "ACLR Sàrl est autorisée à désactiver ou suspendre ses prestations (blocage du site internet ou des outils) dès le premier rappel impayé, et ce jusqu'au paiement intégral, sans que la rémunération totale ne cesse de courir.",
      },
    ],
  },
  {
    number: "6",
    title: "Propriété intellectuelle et usage technique",
    paragraphs: [
      {
        id: "6.1",
        text: "ACLR Sàrl reste titulaire exclusive de tous les droits de propriété intellectuelle sur les logiciels, codes sources, designs et outils mis à disposition du Client. Le droit d'utilisation du Client est strictement limité à la durée du contrat. Tout transfert ou copie du site internet/logiciel à la fin du contrat est exclu.",
      },
      {
        id: "6.2",
        text: "Le Client s'interdit formellement d'effectuer de l'ingénierie inverse, de décompiler ou de copier les outils et logiciels de base d'ACLR Sàrl.",
      },
      {
        id: "6.3",
        text: "Sabotage technique : Si le Client transfère son nom de domaine ou supprime les accès techniques d'ACLR Sàrl en cours de contrat, empêchant l'exécution des prestations, la rémunération totale reste intégralement due.",
      },
    ],
  },
  {
    number: "7",
    title: "Vérification des livrables (« Réception Fiction » sous 5 jours)",
    paragraphs: [
      {
        id: "7.1",
        text: "Le Client est tenu de vérifier la conformité des prestations, sites internet ou livrables immédiatement dès leur mise à disposition ou activation.",
      },
      {
        id: "7.2",
        text: "Toute réclamation pour défaut doit être adressée par écrit détaillé dans un délai de cinq (5) jours ouvrables. À défaut d'avis dans ce délai, le produit/site est réputé accepté sans réserve et la facture finale devient exigible.",
      },
    ],
  },
  {
    number: "8",
    title: "Limitation de responsabilité et décharge tiers",
    paragraphs: [
      {
        id: "8.1",
        text: "La responsabilité d'ACLR Sàrl est exclue dans la mesure permise par la loi, notamment pour les dommages indirects, pertes d'exploitation, gains manqués, pertes de données ou cyberattaques.",
      },
      {
        id: "8.2",
        text: "Plafond financier : Dans tous les cas où la responsabilité d'ACLR Sàrl serait engagée, l'indemnisation est strictement limitée au dommage direct prouvé, et plafonnée à un montant maximum de 20 % de la rémunération annuelle payée par le Client pour le produit concerné.",
      },
      {
        id: "8.3",
        text: "La responsabilité d'ACLR Sàrl est totalement exclue concernant les décisions, modifications d'algorithmes, pannes ou blocages unilatéraux appliqués par des éditeurs et plateformes tierces (tels que Google, Meta, Apple, hébergeurs externes).",
      },
    ],
  },
  {
    number: "9",
    title: "Garantie du Client et Protection des données (LPD)",
    paragraphs: [
      {
        id: "9.1",
        text: "Le Client garantit qu'il est titulaire de tous les droits (marques, images, droits d'auteur) sur les contenus qu'il fournit à ACLR Sàrl. Il garantit également le respect de la Loi fédérale sur la protection des données (LPD) concernant les données de ses propres clients finaux transmis à ACLR Sàrl.",
      },
      {
        id: "9.2",
        text: "Si ACLR Sàrl est attaquée en justice par un tiers à cause d'un contenu, d'un nom de domaine ou d'un fichier de données fourni par le Client, ce dernier s'engage à décharger ACLR Sàrl de toutes prétentions et à l'indemniser intégralement de tous les frais subis (y compris honoraires d'avocat). Cette obligation survit à la fin du contrat sans limite de durée.",
      },
      {
        id: "9.3",
        text: "ACLR Sàrl est autorisée à utiliser les données de performance générées par les outils de manière strictement anonymisée à des fins statistiques et d'amélioration de ses services, y compris après la fin du contrat.",
      },
    ],
  },
  {
    number: "10",
    title: "Forme écrite et For juridique (Double Porte)",
    paragraphs: [
      {
        id: "10.1",
        text: "Aucune promesse orale, modification du contrat ou avenant n'est valable s'ils n'ont pas été conclus par écrit ou confirmés expressément par courriel par la direction d'ACLR Sàrl. Le Client ne peut se prévaloir d'accords verbaux passés avec le représentant commercial sur le terrain.",
      },
      {
        id: "10.2",
        text: "Le présent contrat est soumis exclusivement au droit matériel suisse.",
      },
      {
        id: "10.3",
        text: "Le for juridique exclusif est établi au lieu du siège social de ACLR Sàrl. Toutefois, ACLR Sàrl se réserve expressément le droit d'ouvrir action ou d'engager des procédures de poursuite contre le Client devant le for ordinaire de ce dernier (lieu de son domicile ou de son siège social).",
      },
    ],
  },
];
