/**
 * Conditions Générales de Vente — ACLR Sàrl (MakeYourCom) — version 2026 v2.
 *
 * Single source of truth. Toute modification ici se propage automatiquement à :
 *   - La page publique de signature (/sign/{token})
 *   - Le PDF du contrat (annexé en dernière page)
 *   - Le PDF des factures clients (annexé en dernière page)
 *
 * En cas de modification, BUMP `CGV_VERSION` (utilisée pour la traçabilité
 * juridique : on saura quelle version le client a acceptée).
 */

export const CGV_VERSION = "2026.2";
export const CGV_TITLE =
  "Conditions Générales de Vente — ACLR Sàrl (Make Your Com)";

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
        text: "Les CGV forment partie intégrante du contrat conclu. Les conditions générales du Client sont totalement inapplicables, même si ce dernier y fait référence (notamment dans des confirmations de commande, bons d'achat ou factures émis par le Client).",
      },
      {
        id: "1.3",
        text: "En cas de contradiction entre les documents contractuels, l'ordre de priorité suivant s'applique : (i) le contrat ou bon de commande signé, (ii) les présentes CGV, (iii) les descriptifs de produits publiés en ligne sur les sites d'ACLR Sàrl.",
      },
      {
        id: "1.4",
        text: "ACLR Sàrl est en droit de modifier en tout temps les CGV. Les modifications sont communiquées au Client par un moyen approprié (courrier postal, email, espace client ou mention sur la facture). Lors de chaque paiement de facture ou commande de nouvelle prestation, le Client confirme avoir pris connaissance et accepté les CGV en vigueur.",
      },
    ],
  },
  {
    number: "2",
    title: "Définitions",
    paragraphs: [
      {
        id: "2.0",
        text: "Dans les présentes CGV, les termes suivants ont la signification ci-après définie :",
      },
      {
        id: "2.1",
        text: "« Contenus » : toutes les informations et données fournies par le Client ou publiées via les produits ACLR Sàrl, notamment textes, images, photographies, logos, vidéos, enregistrements sonores, données structurées, mots-clés, métadonnées, droits d'auteur et marques associées.",
      },
      {
        id: "2.2",
        text: "« Date d'activation » : la date à laquelle un produit est mis en ligne, activé, livré ou publié par ACLR Sàrl. À défaut de mention dans le contrat, c'est la date à laquelle ACLR Sàrl notifie le Client de la disponibilité du produit.",
      },
      {
        id: "2.3",
        text: "« Durée du produit » : la période minimale ferme d'engagement courant à compter de la Date d'activation, telle qu'indiquée sur le bon de commande ou définie dans les CGV.",
      },
      {
        id: "2.4",
        text: "« Plateformes tierces » : les plateformes, services et outils opérés par des tiers et utilisés dans le cadre de la fourniture des prestations, notamment Google (Search, Ads, Maps, Business Profile, Analytics), Meta (Facebook, Instagram), LinkedIn, TikTok, YouTube, hébergeurs externes, processeurs de paiement (Stripe, Twint) et registrars de noms de domaine.",
      },
      {
        id: "2.5",
        text: "« Partenaires de services » : les sociétés liées, sous-traitants et autres tiers auxquels ACLR Sàrl fait appel pour la fourniture de ses prestations (hébergeurs, développeurs, photographes, vidéastes, rédacteurs, prestataires SaaS).",
      },
      {
        id: "2.6",
        text: "« Outils » : les systèmes en ligne mis à disposition du Client par ACLR Sàrl pour la gestion de son activité (CRM, dashboard de campagne, espace de gestion, plateformes d'administration de site).",
      },
      {
        id: "2.7",
        text: "« Espace client » : l'interface en ligne sécurisée permettant au Client d'accéder à ses produits, outils, rapports, factures et données.",
      },
      {
        id: "2.8",
        text: "« Fin du contrat » : la date à laquelle la Durée du produit expire ou une résiliation prend effet conformément aux présentes CGV.",
      },
    ],
  },
  {
    number: "3",
    title: "Vente terrain, conclusion du contrat et droit de veto",
    paragraphs: [
      {
        id: "3.1",
        text: "Le contrat est réputé fermement conclu dès l'acceptation de l'offre par le Client. Cette acceptation est matérialisée par signature manuscrite sur support papier, par signature électronique sur l'écran de vente mobile (tablette ou smartphone) du représentant commercial d'ACLR Sàrl, ou par tout acte concluant (paiement d'acompte, transmission d'accès techniques, utilisation d'un produit, validation d'un email de confirmation).",
      },
      {
        id: "3.2",
        text: "Engagement sur la valeur totale. Dès signature, le Client est engagé de manière irrévocable sur la valeur totale et globale des prestations mentionnées sur le bon de commande, y compris pour les prestations à exécution successive.",
      },
      {
        id: "3.3",
        text: "Droit de veto d'ACLR Sàrl. Après examen des données du Client par la direction, ACLR Sàrl se réserve le droit, dans les trente (30) jours suivant la signature, de se départir du contrat sans indication de motifs et sans aucun dédommagement en faveur du Client (notamment pour des raisons d'insolvabilité, d'impossibilité technique, de non-conformité du Client à des principes éthiques ou de risque commercial identifié).",
      },
    ],
  },
  {
    number: "4",
    title: "Durée, renouvellement et interdiction de résiliation anticipée",
    paragraphs: [
      {
        id: "4.1",
        text: "Sauf mention contraire écrite sur le bon de commande, les contrats sont conclus pour une durée minimale ferme correspondant à l'engagement indiqué sur le bon de commande à compter de la Date d'activation. À défaut de précision, la durée minimale ferme est de douze (12) mois.",
      },
      {
        id: "4.2",
        text: "Le contrat se renouvelle automatiquement d'année en année, sauf résiliation notifiée par écrit (courrier recommandé ou formulaire officiel transmis par email à contact@makeyourcom.ch avec accusé de réception) au moins trente (30) jours avant l'expiration de la période en cours.",
      },
      {
        id: "4.3",
        text: "Exclusion du droit de révocation. S'agissant de contrats entre professionnels (B2B), l'application des dispositions légales relatives à la résiliation anticipée ordinaire, notamment l'article 377 du Code des obligations suisse, est expressément exclue. La rémunération totale reste due jusqu'au terme du contrat.",
      },
      {
        id: "4.4",
        text: "Cessation d'activité du Client. L'éventuelle cessation d'activité, faillite, fermeture, vente, fusion ou transformation de l'entreprise du Client n'autorise pas ce dernier à résilier le contrat de manière anticipée. La valeur totale restante du contrat devient immédiatement exigible et sera facturée sous forme de solde final.",
      },
    ],
  },
  {
    number: "5",
    title: "Obligations de collaboration du Client et facturation immédiate",
    paragraphs: [
      {
        id: "5.1",
        text: "ACLR Sàrl dépend de la collaboration active du Client pour exécuter ses prestations (fourniture de logos, textes, images, photos, identifiants d'accès, validations de maquettes, retours dans les délais). Le Client s'engage à exécuter ses obligations de collaboration de manière correcte, complète et dans les délais fixés.",
      },
      {
        id: "5.2",
        text: "Si ACLR Sàrl ne peut pas mettre en ligne, activer ou publier le produit en temps utile en raison du retard ou du manque de collaboration du Client, ACLR Sàrl est en droit de facturer immédiatement l'intégralité de la rémunération totale du contrat. Dans ce cas, le Client ne peut prétendre à aucune réduction ni remboursement, et la Date d'activation est réputée intervenue à la date à laquelle ACLR Sàrl aurait pu livrer si le Client avait collaboré.",
      },
    ],
  },
  {
    number: "6",
    title: "Tarifs, facturation, rappels, factoring et budget publicitaire",
    paragraphs: [
      {
        id: "6.1",
        text: "Les prix s'entendent nets, hors taxe sur la valeur ajoutée (TVA) en sus. Sauf accord écrit, les frais uniques (création, dossier, setup) sont facturés dès la conclusion du contrat, et les abonnements dès l'activation.",
      },
      {
        id: "6.2",
        text: "Les factures doivent être payées sans déduction dans les trente (30) jours suivant leur établissement. À défaut d'opposition écrite et motivée dans ce délai, la facture est réputée acceptée.",
      },
      {
        id: "6.3",
        text: "En l'absence de paiement à l'échéance, le Client tombe en demeure automatique sans rappel nécessaire. Il est redevable de l'intérêt moratoire légal (5 % selon l'art. 104 al. 1 CO) et de frais de rappel fixes : CHF 15.– pour le premier rappel et CHF 25.– pour le deuxième rappel.",
      },
      {
        id: "6.4",
        text: "Factoring et recouvrement. ACLR Sàrl est expressément autorisée à céder ses créances à des tiers (sociétés de recouvrement ou banques de factoring). En cas de cession de la créance à des fins de recouvrement, des frais de dossier de CHF 75.– sont mis à la charge exclusive du Client, en sus des honoraires de recouvrement et frais judiciaires éventuels.",
      },
      {
        id: "6.5",
        text: "ACLR Sàrl est autorisée à désactiver ou suspendre ses prestations (blocage du site internet, des outils, des accès, des campagnes Ads) dès le premier rappel impayé, et ce jusqu'au paiement intégral. La rémunération totale continue à courir pendant la période de suspension.",
      },
      {
        id: "6.6",
        text: "Budget publicitaire non consommé. Si un budget publicitaire a été convenu (notamment pour les prestations Google Ads ou Social Media Ads) et qu'un solde reste disponible à la fin de la durée du contrat, la durée est prolongée automatiquement jusqu'à épuisement du budget. Aucun remboursement de budget non consommé n'est dû.",
      },
      {
        id: "6.7",
        text: "Indexation tarifaire. ACLR Sàrl est en droit, une fois par année civile et avec un préavis de soixante (60) jours, d'indexer les forfaits récurrents à l'évolution de l'indice suisse des prix à la consommation (IPC). Cette indexation ne constitue pas une modification significative au sens de l'article 7 et ne donne pas droit à résiliation anticipée.",
      },
    ],
  },
  {
    number: "7",
    title: "Adaptation des produits et des tarifs",
    paragraphs: [
      {
        id: "7.1",
        text: "ACLR Sàrl est en droit d'adapter en tout temps son portefeuille de produits, les descriptions de prestations, les fonctionnalités et la tarification. Elle peut notamment procéder à des modifications de conception, à des adaptations aux exigences techniques, à la modification, au remplacement ou à la suppression de fonctionnalités et de prestations, ainsi qu'à des adaptations basées sur des modifications imposées par les Plateformes tierces.",
      },
      {
        id: "7.2",
        text: "Si ACLR Sàrl procède à une adaptation significative d'un produit au détriment du Client, ou à une augmentation de la rémunération autre que l'indexation prévue à l'article 6.7, ACLR Sàrl informe le Client au préalable et en temps utile (au moins trente (30) jours avant l'entrée en vigueur) par un moyen approprié.",
      },
      {
        id: "7.3",
        text: "Dans ce cas, le Client est en droit de résilier le produit de manière anticipée avec effet à la date d'entrée en vigueur des adaptations, par notification écrite reçue par ACLR Sàrl au plus tard quinze (15) jours avant cette date d'entrée en vigueur. À défaut de résiliation dans ce délai, les adaptations sont réputées acceptées.",
      },
    ],
  },
  {
    number: "8",
    title: "Propriété intellectuelle et usage technique",
    paragraphs: [
      {
        id: "8.1",
        text: "ACLR Sàrl reste titulaire exclusive de tous les droits de propriété intellectuelle sur les logiciels, codes sources, designs, templates, méthodologies, processus, prompts d'intelligence artificielle, outils internes et bases de données développés ou mis à disposition. Le droit d'utilisation du Client est strictement limité à la durée du contrat et au but contractuel.",
      },
      {
        id: "8.2",
        text: "Tout transfert, copie ou réutilisation des éléments techniques (code, base de données, configurations) à la fin du contrat est exclu. Le Client peut toutefois exporter ses propres Contenus (textes, images qu'il a fournis) avant la fin du contrat.",
      },
      {
        id: "8.3",
        text: "Le Client s'interdit formellement d'effectuer de l'ingénierie inverse, de décompiler, de désassembler ou de copier les outils et logiciels propriétaires d'ACLR Sàrl.",
      },
      {
        id: "8.4",
        text: "Sabotage technique. Si le Client transfère son nom de domaine, modifie les enregistrements DNS, supprime les accès techniques d'ACLR Sàrl ou prend toute mesure empêchant l'exécution des prestations en cours de contrat, la rémunération totale reste intégralement due. ACLR Sàrl se réserve en outre le droit de réclamer des dommages-intérêts pour le préjudice subi.",
      },
    ],
  },
  {
    number: "9",
    title: "Vérification des livrables (« Réception fiction » sous 5 jours)",
    paragraphs: [
      {
        id: "9.1",
        text: "Le Client est tenu de vérifier la conformité des prestations, sites internet, contenus ou autres livrables immédiatement dès leur mise à disposition ou activation.",
      },
      {
        id: "9.2",
        text: "Toute réclamation pour défaut doit être adressée par écrit détaillé (par email à contact@makeyourcom.ch ou par courrier recommandé) dans un délai de cinq (5) jours ouvrables. À défaut d'avis dans ce délai, le produit, le site ou la prestation est réputé(e) accepté(e) sans réserve et la facture finale devient exigible.",
      },
      {
        id: "9.3",
        text: "Les défauts cachés et ceux qui surviennent au cours de la durée du contrat doivent être annoncés à ACLR Sàrl dès leur découverte. ACLR Sàrl a le choix d'éliminer les défauts ou d'offrir une prestation de remplacement, à l'exclusion de toute autre prétention du Client.",
      },
    ],
  },
  {
    number: "10",
    title: "Service Levels et disponibilité",
    paragraphs: [
      {
        id: "10.1",
        text: "Pour les produits sur-mesure (notamment Site CRM Entreprise, plateformes développées spécifiquement), des Service Levels spécifiques peuvent être prévus dans le bon de commande ou dans une annexe contractuelle dédiée.",
      },
      {
        id: "10.2",
        text: "À défaut de mention expresse, ACLR Sàrl s'efforce d'assurer un haut degré de disponibilité de ses produits et plateformes dans un délai raisonnable, sans pouvoir garantir un fonctionnement sans interruption ni dérangement. Les indisponibilités liées à des maintenances planifiées, à des Plateformes tierces ou à des cas de force majeure ne constituent pas un manquement contractuel.",
      },
      {
        id: "10.3",
        text: "Les travaux d'entretien sont, dans la mesure du possible, effectués en dehors des heures ouvrables (jours ouvrables, 09h00 à 17h00) et avec un avis préalable au Client.",
      },
    ],
  },
  {
    number: "11",
    title: "Limitation de responsabilité et décharge tiers",
    paragraphs: [
      {
        id: "11.1",
        text: "La responsabilité d'ACLR Sàrl est exclue dans la mesure permise par la loi, notamment pour les dommages indirects, pertes d'exploitation, gains manqués, pertes de données, atteintes à la réputation, cyberattaques et toutes conséquences réflexes ou consécutives.",
      },
      {
        id: "11.2",
        text: "Plafond financier. Dans tous les cas où la responsabilité d'ACLR Sàrl serait engagée, l'indemnisation est strictement limitée au dommage direct et avéré, et plafonnée à un montant maximum de vingt pourcent (20 %) de la rémunération annuelle effectivement payée par le Client pour le produit concerné au cours des douze (12) mois précédant la survenance du dommage.",
      },
      {
        id: "11.3",
        text: "La responsabilité d'ACLR Sàrl est totalement exclue concernant les décisions, modifications d'algorithmes, pannes, blocages ou changements de politique unilatéralement appliqués par les Plateformes tierces (Google, Meta, LinkedIn, TikTok, YouTube, Apple, Stripe, hébergeurs externes, registrars de domaine).",
      },
      {
        id: "11.4",
        text: "La responsabilité d'ACLR Sàrl pour les actes et omissions des Partenaires de services est exclue. Toute responsabilité directe des Partenaires de services envers le Client est également exclue.",
      },
    ],
  },
  {
    number: "12",
    title: "Garanties du Client",
    paragraphs: [
      {
        id: "12.0",
        text: "Le Client garantit expressément :",
      },
      {
        id: "12.1",
        text: "(i) qu'il respecte le droit applicable, notamment l'interdiction de la concurrence déloyale, le droit des marques, la législation sur le droit d'auteur, les droits de la personnalité et la protection des données ;",
      },
      {
        id: "12.2",
        text: "(ii) que les Contenus qu'il fournit ne violent ni les prescriptions légales ni les droits de tiers (raisons sociales, marques, droits d'auteur, droits voisins, droit à l'image) ;",
      },
      {
        id: "12.3",
        text: "(iii) que les Contenus sont actuels, corrects, conformes aux directives publicitaires des Plateformes tierces, et qu'ils ne sont pas racistes, discriminatoires, attentatoires à la personnalité, incitant à la violence, diffamants, offensants ou donnant lieu à du harcèlement ;",
      },
      {
        id: "12.4",
        text: "(iv) qu'il est titulaire de tous les droits nécessaires sur les Contenus (y compris sur les noms de domaine qui doivent être transférés à ACLR Sàrl pour la fourniture des prestations) et peut en disposer sans restriction ;",
      },
      {
        id: "12.5",
        text: "(v) qu'il dispose d'un droit illimité d'accorder à ACLR Sàrl, à ses Partenaires de services et aux Plateformes tierces les droits d'utilisation, de reproduction, de traduction, de transmission, de publication et d'adaptation des Contenus nécessaires à la fourniture des prestations ;",
      },
      {
        id: "12.6",
        text: "(vi) qu'il possède toutes les autorisations administratives et professionnelles nécessaires à l'exercice de son activité commerciale.",
      },
      {
        id: "12.7",
        text: "Si ACLR Sàrl est attaquée en justice ou recherchée par un tiers à raison d'une violation des garanties ci-dessus (notamment à cause d'un Contenu, d'un nom de domaine ou d'un fichier de données fourni par le Client), le Client s'engage à décharger ACLR Sàrl de toutes prétentions et à l'indemniser intégralement de tous les frais subis (y compris honoraires d'avocat et frais judiciaires). Cette obligation survit à la fin du contrat sans limite de durée.",
      },
    ],
  },
  {
    number: "13",
    title: "Protection des données (Loi fédérale sur la protection des données — LPD 2023)",
    paragraphs: [
      {
        id: "13.1",
        text: "Cadre général. Chaque partie respecte la Loi fédérale sur la protection des données du 25 septembre 2020 (LPD), entrée en vigueur le 1er septembre 2023, ainsi que l'ordonnance sur la protection des données (OPDo) et, le cas échéant, le Règlement général sur la protection des données (RGPD) de l'Union européenne pour les traitements concernant des personnes situées dans l'UE.",
      },
      {
        id: "13.2",
        text: "Qualification des parties. Pour les traitements de données personnelles relatives aux clients finaux du Client effectués dans le cadre de la fourniture des prestations, ACLR Sàrl agit en qualité de sous-traitant au sens de l'article 9 LPD. Le Client est responsable de traitement et seul redevable des obligations légales à l'égard des personnes concernées.",
      },
      {
        id: "13.3",
        text: "Instructions et finalités. ACLR Sàrl ne traite les données personnelles transmises par le Client qu'aux fins de l'exécution du contrat et conformément aux instructions documentées du Client. ACLR Sàrl informe sans délai le Client si une instruction est susceptible de violer la législation applicable.",
      },
      {
        id: "13.4",
        text: "Mesures techniques et organisationnelles. ACLR Sàrl met en œuvre des mesures techniques et organisationnelles appropriées pour protéger les données personnelles (chiffrement TLS des transmissions, accès restreints, journalisation, sauvegardes régulières, mises à jour de sécurité, formation du personnel). La liste de ces mesures peut être communiquée sur demande écrite motivée du Client.",
      },
      {
        id: "13.5",
        text: "Confidentialité du personnel. ACLR Sàrl veille à ce que toutes les personnes autorisées à traiter les données personnelles s'engagent à respecter la confidentialité ou soient soumises à une obligation légale de secret appropriée.",
      },
      {
        id: "13.6",
        text: "Sous-traitants ultérieurs. ACLR Sàrl est autorisée à confier le traitement de données personnelles à des sous-traitants ultérieurs (hébergeurs, Partenaires de services, outils SaaS notamment Google Workspace, Stripe, Resend, plateformes d'envoi d'emails). La liste des sous-traitants ultérieurs principaux est disponible sur demande. ACLR Sàrl notifie le Client de tout changement significatif. À défaut d'opposition motivée du Client dans les quinze (15) jours suivant la notification, le changement est réputé accepté.",
      },
      {
        id: "13.7",
        text: "Transferts hors Suisse / UE. Lorsque des données personnelles sont transférées hors de Suisse ou de l'Espace économique européen, ACLR Sàrl s'assure que des garanties appropriées sont en place (décision d'adéquation, clauses contractuelles types de la Commission européenne, mesures supplémentaires si nécessaire).",
      },
      {
        id: "13.8",
        text: "Notification d'incident. En cas de violation de la protection des données relevant de la sphère de responsabilité d'ACLR Sàrl, ACLR Sàrl notifie le Client dans un délai raisonnable et au plus tard dans les soixante-douze (72) heures après en avoir pris connaissance, en lui fournissant les informations nécessaires à ses propres obligations d'annonce auprès du PFPDT.",
      },
      {
        id: "13.9",
        text: "Droit d'inspection. Lorsque cela est impérativement nécessaire en vertu du droit applicable et que les informations mises à disposition par ACLR Sàrl ne suffisent pas, le Client peut procéder, à ses frais, à une inspection limitée. L'inspection est réalisée par le Client ou par un réviseur indépendant soumis à confidentialité et approuvé par ACLR Sàrl, dans les heures ouvrables, après concertation préalable, et sans nuire au bon fonctionnement d'ACLR Sàrl ni à la protection des données d'autres clients.",
      },
      {
        id: "13.10",
        text: "Fin du contrat. À la fin du contrat, ACLR Sàrl efface les données personnelles traitées en qualité de sous-traitant, sauf obligation légale de conservation (notamment fiscale, comptable, ou de prévention de litige). Lorsque l'effacement n'est pas possible qu'au prix d'efforts disproportionnés (par exemple dans des sauvegardes), ACLR Sàrl bloque l'accès aux données plutôt que de les effacer, et maintient les obligations de confidentialité du présent article.",
      },
      {
        id: "13.11",
        text: "Données agrégées et anonymisées. ACLR Sàrl est autorisée à utiliser les données de performance générées par les outils sous forme strictement anonymisée à des fins statistiques, d'amélioration de ses services, de benchmarking et de développement de fonctionnalités, y compris après la fin du contrat.",
      },
      {
        id: "13.12",
        text: "Frais. Les prestations d'assistance d'ACLR Sàrl liées aux articles 13.8, 13.9 et à la mise en œuvre des droits des personnes concernées peuvent être facturées au Client sur la base d'un taux horaire de CHF 180.– après notification préalable, lorsque ces prestations excèdent un usage raisonnable.",
      },
    ],
  },
  {
    number: "14",
    title: "Espace client et outils",
    paragraphs: [
      {
        id: "14.1",
        text: "ACLR Sàrl peut mettre à disposition du Client un Espace client en ligne et des Outils (CRM, dashboard de campagne, espace de gestion de site, rapports SEO). L'utilisation de ces accès est strictement limitée au Client, à ses succursales et à ses collaborateurs autorisés.",
      },
      {
        id: "14.2",
        text: "Le Client est tenu de traiter ses identifiants et mots de passe de manière strictement confidentielle et de les protéger contre tout abus. Le Client est seul responsable de toutes les actions effectuées via ses comptes.",
      },
      {
        id: "14.3",
        text: "En cas d'abus suspecté ou avéré de ses identifiants, le Client doit en informer ACLR Sàrl immédiatement. ACLR Sàrl peut, sans préavis, suspendre ou modifier les accès pour des motifs de sécurité, jusqu'à résolution complète.",
      },
      {
        id: "14.4",
        text: "ACLR Sàrl peut modifier les fonctionnalités, l'apparence et les modalités d'accès à l'Espace client et aux Outils à tout moment, dans les limites de l'article 7.",
      },
    ],
  },
  {
    number: "15",
    title: "Modèles de documents fournis",
    paragraphs: [
      {
        id: "15.1",
        text: "Lorsqu'ACLR Sàrl met à disposition du Client des modèles de documents (mentions légales, conditions générales de vente, conditions d'utilisation, déclarations de protection des données, politiques cookies), il appartient au Client de les adapter à son activité commerciale et de vérifier leur conformité avec le droit applicable à sa situation particulière.",
      },
      {
        id: "15.2",
        text: "ACLR Sàrl ne fournit aucun conseil juridique et toute révision juridique des modèles adaptés par le Client est exclue. Toute garantie et responsabilité d'ACLR Sàrl en relation avec ces modèles de documents est exclue dans la mesure permise par la loi.",
      },
      {
        id: "15.3",
        text: "Le Client est invité à faire valider les documents juridiques de son entreprise par un avocat ou un conseiller juridique qualifié.",
      },
    ],
  },
  {
    number: "16",
    title: "Confidentialité réciproque",
    paragraphs: [
      {
        id: "16.1",
        text: "Chaque partie s'engage à traiter de manière strictement confidentielle toutes les informations non publiques portées à sa connaissance dans le cadre de la relation contractuelle, notamment les informations commerciales, techniques, financières, stratégiques, données clients et savoir-faire de l'autre partie.",
      },
      {
        id: "16.2",
        text: "Cette obligation de confidentialité s'applique pendant toute la durée du contrat et pendant trois (3) ans après sa fin, sauf pour les informations couvertes par le secret professionnel, la protection des données ou un secret d'affaires, qui restent confidentielles sans limitation de durée.",
      },
      {
        id: "16.3",
        text: "Sont exclues de l'obligation de confidentialité les informations qui sont ou deviennent publiquement accessibles sans faute de la partie réceptrice, celles déjà connues de la partie réceptrice avant leur communication, et celles dont la divulgation est requise par une autorité compétente ou une décision judiciaire.",
      },
    ],
  },
  {
    number: "17",
    title: "Non-débauchage du personnel et des partenaires",
    paragraphs: [
      {
        id: "17.1",
        text: "Pendant toute la durée du contrat et pendant les vingt-quatre (24) mois suivant son terme, quelle qu'en soit la cause, le Client s'interdit de solliciter, de tenter d'engager, d'engager directement ou indirectement, par lui-même ou par personne interposée, tout salarié, mandataire, sous-traitant ou Partenaire de services d'ACLR Sàrl avec lequel le Client est entré en contact dans le cadre de l'exécution du contrat.",
      },
      {
        id: "17.2",
        text: "En cas de violation de la présente clause, le Client est redevable à ACLR Sàrl d'une indemnité forfaitaire équivalant à douze (12) mois de rémunération brute de la personne concernée, ou à douze (12) mois d'honoraires moyens versés par ACLR Sàrl au Partenaire de services concerné, sans préjudice du droit d'ACLR Sàrl à demander la réparation du dommage effectif supérieur.",
      },
    ],
  },
  {
    number: "18",
    title: "Cession et transfert du contrat",
    paragraphs: [
      {
        id: "18.1",
        text: "ACLR Sàrl est en droit de transférer à un tiers un ou plusieurs droits et obligations découlant du contrat, voire l'intégralité de la relation contractuelle, notamment dans le cadre d'une cession de fonds de commerce, d'une fusion, d'une restructuration ou d'un partenariat stratégique. ACLR Sàrl en informe le Client dans un délai raisonnable.",
      },
      {
        id: "18.2",
        text: "Un transfert à des tiers par le Client est exclu sans accord écrit préalable d'ACLR Sàrl. La sous-traitance des prestations à un tiers ou leur revente sans accord express d'ACLR Sàrl est interdite.",
      },
    ],
  },
  {
    number: "19",
    title: "Communications et notifications",
    paragraphs: [
      {
        id: "19.1",
        text: "Les communications entre les parties sont valablement effectuées par courrier postal, par email aux adresses indiquées dans le contrat ou via l'Espace client. ACLR Sàrl peut notifier les modifications de CGV, factures, rappels et résiliations par tout moyen approprié.",
      },
      {
        id: "19.2",
        text: "Le Client est tenu de communiquer à ACLR Sàrl, en temps utile et par écrit, toute modification de son adresse postale, de son adresse email, de son numéro de téléphone, de son interlocuteur principal ou de ses coordonnées bancaires.",
      },
      {
        id: "19.3",
        text: "ACLR Sàrl n'assume aucune responsabilité pour les communications adressées aux coordonnées précédemment communiquées par le Client tant que celui-ci n'a pas notifié leur modification.",
      },
    ],
  },
  {
    number: "20",
    title: "Force majeure",
    paragraphs: [
      {
        id: "20.1",
        text: "Aucune des parties ne peut être tenue pour responsable de l'inexécution ou du retard dans l'exécution de ses obligations contractuelles lorsque cette inexécution est due à un événement de force majeure, c'est-à-dire un événement extérieur, imprévisible et irrésistible empêchant l'exécution normale des obligations.",
      },
      {
        id: "20.2",
        text: "Sont notamment considérés comme cas de force majeure : catastrophes naturelles, incendies, inondations, épidémies et pandémies, guerres, attentats, grèves, lock-out, défaillance majeure d'infrastructures publiques ou de Plateformes tierces, cyberattaques d'envergure (notamment Denial-of-Service massive), décisions gouvernementales ou administratives empêchant l'exécution du contrat.",
      },
      {
        id: "20.3",
        text: "La partie affectée notifie sans délai l'autre partie de la survenance du cas de force majeure et de ses conséquences prévisibles. Les obligations affectées sont suspendues pendant la durée du cas de force majeure. Si celui-ci se prolonge au-delà de soixante (60) jours, chaque partie peut résilier le contrat par notification écrite, sans indemnité de part et d'autre, étant entendu que les prestations déjà exécutées restent dues.",
      },
    ],
  },
  {
    number: "21",
    title: "Validité partielle",
    paragraphs: [
      {
        id: "21.1",
        text: "Si une ou plusieurs dispositions des présentes CGV s'avéraient invalides, illégales ou inapplicables par décision d'une autorité compétente, la validité des autres dispositions n'en serait pas affectée.",
      },
      {
        id: "21.2",
        text: "Les parties s'engagent à remplacer la disposition invalide par une disposition valide poursuivant le but économique et juridique le plus proche de la disposition originale.",
      },
    ],
  },
  {
    number: "22",
    title: "Forme écrite et for juridique (Double porte)",
    paragraphs: [
      {
        id: "22.1",
        text: "Aucune promesse orale, modification du contrat ou avenant n'est valable s'il n'a pas été conclu par écrit ou confirmé expressément par courriel par la direction d'ACLR Sàrl. Le Client ne peut se prévaloir d'accords verbaux passés avec un représentant commercial sur le terrain ou un sous-traitant d'ACLR Sàrl.",
      },
      {
        id: "22.2",
        text: "Le présent contrat est soumis exclusivement au droit matériel suisse, à l'exclusion des règles de conflit de lois et de la Convention de Vienne sur la vente internationale de marchandises.",
      },
      {
        id: "22.3",
        text: "For juridique (Double porte). Le for juridique exclusif est établi au lieu du siège social d'ACLR Sàrl. Toutefois, ACLR Sàrl se réserve expressément le droit d'ouvrir action ou d'engager des procédures de poursuite contre le Client devant le for ordinaire de ce dernier (lieu de son domicile ou de son siège social). Les fors impératifs sont réservés.",
      },
    ],
  },
];
