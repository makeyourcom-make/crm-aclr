# Conventions métier ACLR Sàrl / MakeYourCom — Transfert vers CRM

Document de référence pour l'import des données dans le CRM Next.js/Prisma. À lire avant d'écrire le script `import-from-cowork.ts`.

---

## 1. Identité société

| Champ | Valeur |
|---|---|
| Raison sociale | ACLR Sàrl |
| Marque commerciale | MakeYourCom |
| Adresse siège | Route de la Jorette 66, 1899 Torgon, Suisse |
| IDE | CHE-147.095.764 |
| Email | contact@makeyourcom.ch |
| Site | makeyourcom.ch |
| IBAN CHF | CH34 0024 7247 3054 7502 T |
| IBAN EUR | CH24 0024 7247 3054 7560 Z |
| BIC EUR | UBSWCHZH80A |
| Banque | UBS Switzerland AG |
| TVA | **NON assujettie** (CA < 100k CHF seuil suisse) — aucune TVA n'est facturée aux clients |

---

## 2. Numérotation factures

Format en vigueur : `AA-NNN` (ex : `26-91`)
- `AA` = 2 derniers chiffres de l'année (26 = 2026)
- `NNN` = séquence simple, incrément continu sur l'année
- **Dernier numéro utilisé : `26-91`** → la prochaine facture en 2026 sera `26-92`
- Bascule 2027 : `27-001` ou `27-1` (à arbitrer côté CRM — la séquence repart de 1 chaque 1er janvier)
- Le préfixe `27-XX` dans le JSON désigne des factures **planifiées 2027 sans numéro définitif** — les traiter comme placeholders

> **Recommandation côté CRM** : si tu veux passer à `ACLR-2026-0092` pour homogénéiser avec ton format existant, prévois un mapping `legacyNumber` → nouveau format dans la table Facture, et garde l'ancien numéro affiché sur les PDFs déjà émis pour ne rien casser côté clients.

---

## 3. Enums utilisés (mapping vers ton schéma Prisma)

### Statuts factures
Valeurs trouvées dans `factures.json`, champ `statut` :

| Valeur Excel | Sens | Mapping Prisma suggéré |
|---|---|---|
| `Planifiée` | Future, pas encore générée | `PLANIFIEE` |
| `Préparée` | PDF généré mais pas envoyé au client | `PREPAREE` |
| `Envoyée` | Brouillon Gmail créé ou email envoyé | `ENVOYEE` |
| `Payée` | Encaissement confirmé sur relevé UBS | `PAYEE` |
| `Annulée` | Factures invalidées (ex: 26-60 Soverial) | `ANNULEE` |

> Convention forte : **dès qu'un brouillon Gmail est créé pour une facture, son statut passe à `Envoyée`** (même si l'envoi physique n'est pas encore fait — le brouillon vaut envoi prévu).

### Statuts clients (champ `statut`)
- `Actif`, `Inactif`, `Prospect`

### Statuts contrats
- `Actif`, `Suspendu`, `Résilié`, `Terminé`

### Catégories charges (champ `categorieSource` du JSON)
| Source Excel | Mapping `ExpenseCategorie` suggéré |
|---|---|
| `Web` | `WEB_HOSTING` (LWS, Infomaniak, domaines, hébergements) |
| `Admin` | `ADMIN_FRAIS` (impôts CFE, Sunrise, fournitures, repas pro) |
| `IA` | `SOFTWARE_SAAS` (Claude, Anthropic, ChatGPT, outils IA) |
| `Marketing` | `MARKETING_PUB` (Google Ads, Meta Ads) |
| `Bancaire` | `FRAIS_BANCAIRES` |
| `Restauration` | `RESTAURATION_CLIENT` (rendez-vous, déplacements) |

---

## 4. Devises et conversions

ACLR est en Suisse mais paie/reçoit aussi en EUR (clients FR + fournisseurs FR comme LWS, Anthropic).

**Taux de change appliqués pour la compta (figés sur l'année 2026)** :
- EUR → CHF : **× 0.95**
- USD → CHF : **× 0.895**

> Ces taux sont des **approximations stabilisées**, pas le taux du jour. Tous les montants en `Charges` sont stockés en CHF après conversion. Si une charge est en EUR à l'origine, le montant EUR HT et TTC est conservé en `notes`.

**Factures clients** :
- Majorité en CHF (clients suisses)
- Quelques-unes en EUR (clients français) — celles-ci portent un **bloc paiement EUR** avec l'IBAN EUR au lieu du QR-bill suisse

---

## 5. Cycles de facturation par client

Cas particuliers à respecter pour ne pas casser la séquence en place :

| Client | Cadence | Notes |
|---|---|---|
| **SOS Pneus** | Bi-mensuel (1-15 et 16-31 du mois) | Formule : Budget Google ADS × 1.30 + 59 CHF (Pack Sérénité) + éventuelle compensation mois précédent |
| **Frakaxessoires** | Mensuel | 98 CHF/mois |
| **Hôtel de Torgon** | Mensuel split | 100 CHF prestation + 39 CHF site web (à séparer en 2 lignes sur la facture) |
| **Lionel Briquet** | Annuel | 317 CHF, renouvellement auto en avril |
| **Casavue** | Annuel | 588 CHF, renouvellement auto en juin |
| **Qerkini Sàrl** | Annuel | 530.44 CHF, période mai→avril, inclut domaine LWS |
| **TournemainConsult** | Annuel | Cycle calendaire **février → janvier** (PAS calendrier civil) |
| **Soverial** | Annuel | 468 CHF |
| **Roch SA** | Annuel | 249 CHF, en mars |
| **SP Industriel** | Mensuel | Avec répartition Lucas |
| **Unleash Lab** | Mensuel | 563.70 CHF/mois jusqu'à fin contrat |
| **ARCOZ AG** | 3 paiements (1/3, 2/3, 3/3) | Tunnel de vente — 26-36, 26-37, 26-38 |
| **Passeport Beauté** | Variable | Inclut Licence Photo IA |
| **LocFactory** | Mensuel | Avec répartition Lucas |

---

## 6. Charges refacturées vs. internes (logique critique)

### Domaines internes MakeYourCom (PAS de refacturation)
Toutes ces extensions sont à comptabiliser comme charges internes, sans contrepartie client :
- `cmo-suisse.ch` / `cmo-suisse.com`
- `make-marketing.ch` (NB : .ch refacturé à 100% à Laëtitia Rigolot / M A K E & Beyond via facture 26-91)
- `responsable-marketing.ch` / `responsable-marketing.com`
- `marketing-externe.ch` / `marketing-externe.fr` / `marketing-externe.com`

### Charges incluses dans contrats clients (donc imputées au client en Rentabilité)
- **Qerkini** : domaine `qerkini.ch` (LWS) — inclus dans les 530.44 CHF/an
- **ARCOZ AG** : domaine `arcoz-ag.ch` + Pack email 5 boîtes (Infomaniak) + Outil Emelia cold mailing — tous inclus dans le contrat 6 256 CHF
- **Lionel Briquet** : domaine `physio-montreux.ch` (LWS) — inclus dans 317 CHF/an
- **Laverie Nevers** : domaines `laverie-nevers.com/.fr` — à refacturer en sus (non inclus contrat)

### Coûts mutualisés à répartir
- **Google Workspace Business Standard** : ~38.88 EUR/mois pour 2 licences — la licence `make-marketing.ch` (~19.44 EUR) est refacturée à 100% à M A K E & Beyond (Laëtitia Rigolot)
- **Lucas Carlin** (sous-traitant n°150) : facturation à répartir par projet — voir feuille Rentabilité pour la clé (SP Industriel, LocFactory, Passeport Beauté, Hôtel Torgon)
- **Google ADS** : facturation Google = global, refacturation client = par budget alloué

---

## 7. Conventions de nommage fichiers PDF

### Factures
`Factures/{numero} - {Nom Client}.pdf`
- Exemples : `26-38 - ARCOZ AG.pdf`, `26-91 - M A K E & Beyond.pdf`
- Caractère `&` autorisé dans le nom de fichier
- Espaces dans le nom : autorisés

### Contrats signés (dossier `Contrats/`)
`{Nom Client} - {Description} - SIGNER.pdf` (ou `.jpeg` si scan)
- Exemples : `Arcoz AG - Tunnel de vente - SIGNER.pdf`, `Unleash Lab Sàrl - Phase 2.1 SIGNER.pdf`
- Le suffixe `SIGNER` indique que le contrat a été signé par le client (à conserver dans la migration pour distinguer les contrats actifs des templates)

### Reçus / tickets de charges
Pas de convention figée. Les PDFs et tickets sont conservés dans `uploads/` (côté Cowork) avec leur nom d'origine fournisseur. À migrer dans `tickets/{YYYY-MM}/{description-courte}.pdf` côté CRM.

### CGV
`CGV 2026.pdf` à la racine du dossier — annexée automatiquement à toutes les nouvelles factures (3 dernières pages) et tous les nouveaux contrats/devis générés par `facturation.py`.

---

## 8. Particularités clients / dossiers ouverts au moment du transfert

Ces notes contextuelles sont **importantes** pour le futur Claude Code qui prendra le relais — elles ne sont pas dans les JSON :

### Frakaxessoires (C12)
- A doublement payé la facture 26-39 en mars-avril-mai 2026 (3× au lieu de 1×)
- **600 CHF de trop-perçu remboursé directement par virement** — pas de crédit appliqué sur factures suivantes
- Les 9 factures mensuelles `26-43` à `26-51` (juin 2026 → février 2027) sont en statut `Préparée` mais doivent être envoyées au fil de l'eau, pas en une fois
- Rappel : domaine à **résilier avant le 11.02.2027** pour ne pas déclencher le renouvellement automatique chez LWS

### Soverial (C08)
- Facture 26-60 a été **annulée** par erreur (le client a reçu 26-60 et 26-85 et était confus) — un email de clarification a été envoyé par Xavier Soverial
- Conserver 26-60 en base avec statut `Annulée` + note explicative

### LWS doublon FC-2701352 (en cours)
- Facture LWS FC-2701352 du 21.05.2026 (11.99 EUR pour `make-marketing.ch`) suspectée d'être un **doublon** de FC-2697695 du 17.05.2026
- Pas encore comptabilisée en charges, en attente de résolution avec LWS
- À tracer dans le CRM comme `litige fournisseur` ou à laisser de côté en fonction du retour

### ARCOZ AG (C04)
- Facture 26-38 (3/3) à 2 086 CHF est **Préparée depuis le 27.04.2026 mais jamais envoyée** — échéance théorique 27.05.2026
- Le client a déjà payé 26-36 et 26-37 sans incident
- Le contrat ARCOZ inclut **Emelia + Infomaniak** comme charges fournisseur — à ne pas refacturer en sus

### TournemainConsult (C06)
- Cycle de facturation **calendaire février → janvier**, PAS le calendrier civil
- Facture 27-XX placeholder pour février 2027 — à transformer en facture définitive le moment venu

### SOS Pneus (C17)
- Compensation d'avril : ~190.24 CHF de sous-facturation à reporter sur la facture suivante
- Formule mensuelle : Budget Google ADS × 1.30 + 59 CHF Pack Sérénité (+ compensations éventuelles)

### Hôtel de Torgon (C01)
- Facture 26-87 planifiée pour 01.06.2026 : **1891.50 CHF** (création du site internet 2/2)
- Facturation mensuelle split entre prestation (100) et entretien site (39)

### Lucas Carlin (sous-traitant — pas client)
- Facture n°150 a été saisie en charges et répartie par projet en Rentabilité
- N'est PAS un client à importer, c'est un **fournisseur** (prestataire)

---

## 9. Logique génération PDF (référence pour migration)

Le générateur actuel est `facturation.py` (ReportLab). Trois fonctions publiques :
- `generate_facture(numero, client, items, ...)` → PDF facture + QR-bill suisse + CGV
- `generate_devis(numero, client, items, ...)` → PDF devis + CGV
- `generate_contrat(numero, client, title, clauses, ...)` → PDF contrat + CGV

**Charte graphique** (à reproduire dans le CRM Next.js) :
- Couleur primaire NAVY : `#070F33`
- Accent COPPER : `#C4956A`
- Fond clair CREAM : `#F5F0EB`
- Logo PNG : `logo-makeyourcom.png` (52mm dans le header banner)
- Police : Helvetica + Times-Roman pour le titre "Facture"
- Format prix : `1 234.56 -.` (avec suffixe ` -.` après tous les chiffres SAUF la ligne TOTAL qui finit par ` CHF`)
- Bloc TOTAL en encart NAVY sur fond foncé

Le QR-bill suisse est généré à partir de `Swiss-QR-bill.pdf` (template statique) — pas regénéré dynamiquement.

---

## 10. Plan de migration recommandé

1. **Import clients** depuis `clients.json` → table `Prospect` ou `Contract` selon ton modèle (champs déjà mappés)
2. **Import contrats** depuis `contrats.json` (bonus) — utile si ton CRM gère les contrats à part
3. **Import factures** depuis `factures.json` → table `FactureClient` (statuts à mapper sur tes enums)
4. **Import charges** depuis `charges.json` → table `Expense` (catégorieSource conservée pour traçabilité)
5. **Reprendre la numérotation** à partir de `26-92` pour ne pas avoir de collision avec les factures déjà émises
6. **Migrer les PDFs existants** : copier `Factures/` et `Contrats/` dans le stockage du CRM, créer les liens en base
7. **Annexer les CGV** dans le pipeline de génération PDF du CRM (3 pages PDF à merger en fin de document)

---

## 11. Données NON exportées (à ressaisir manuellement si besoin)

- **Tableau de bord** : c'est des KPIs calculés, à régénérer côté CRM
- **Rentabilité** : c'est des calculs dérivés (CA - charges par client), à régénérer
- **Bilan Mensuel** : pareil, à régénérer
- **Prévisions** : seules les factures `Planifiée` sont dans `factures.json` — les prévisions à long terme (au-delà du planifié) ne sont pas exportées
- **Devis** : 6 devis dans la feuille, importables si besoin (similaire à `factures.json`)
- **Prospects** : 3 entrées non-clients, à voir si tu veux les migrer

Si besoin de l'un de ces exports, demande à Cowork une dernière fois avant l'arrêt complet.

---

*Document généré le 29 mai 2026 par Cowork (Claude) — dernière session de transfert.*
