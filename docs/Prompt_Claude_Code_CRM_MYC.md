# PROMPT — Construire un CRM commercial complet pour ACLR Sàrl (Make Your Com)

> Copie ce prompt complet dans Claude Code (`claude` en CLI ou Claude Code dans VS Code) au démarrage d'un nouveau projet. Claude Code va scaffolder, coder, tester et te livrer le CRM en autonomie en plusieurs sessions.

---

## CONTEXTE BUSINESS

Tu vas construire un CRM commercial complet pour **ACLR Sàrl**, société qui exploite la marque **Make Your Com** — agence de communication digitale basée en Suisse romande.

Le CRM est destiné à un usage interne par 2 utilisateurs maximum :
- **Sophie Salvan** (commerciale terrain, profil "commercial")
- **Arthur Chazelle** (fondateur, profil "admin")

L'agence vend les services suivants :
- Sites web (livraison 5-7 jours grâce à IA)
- Gestion réseaux sociaux
- Référencement SEO local
- Publicité Google et Meta Ads
- CMO fractionné
- Licences Metricool

Tarification standard (à seeder dans le catalogue) :
- Site simple : CHF 400 one-shot + CHF 39/mois forfait
- Site haut : CHF 1'000 one-shot + CHF 59/mois forfait
- RS basique : CHF 249/mois
- SEO basique : CHF 59/mois
- Ads (part MYC) : CHF 349 setup + CHF 45/mois (30% de CHF 150 facturé client)
- CMO basique : CHF 399/mois
- Metricool licence : CHF 249/an
- Pack Web (Site haut + SEO)
- Pack Web Complet (Site haut + SEO + Ads)
- Pack Gestion (CMO + RS)
- Pack CMO Plus (CMO + RS + Site haut)
- Pack Premium (TOUT)

---

## STACK TECHNIQUE IMPOSÉE

- **Framework** : Next.js 15 App Router + TypeScript strict
- **UI** : Tailwind CSS + shadcn/ui (composants pré-faits, accessibles)
- **Base de données** : PostgreSQL 16 via Docker
- **ORM** : Prisma
- **Authentification** : NextAuth.js, provider Credentials, 2 utilisateurs seedés
- **Validation** : Zod sur tous les schémas et formulaires
- **Forms** : React Hook Form
- **Tableaux** : TanStack Table v8
- **Graphiques** : Recharts
- **Dates** : date-fns avec locale `fr`
- **PDF** : `@react-pdf/renderer` pour les factures
- **Email** : Resend (sortants + inbound webhooks)
- **Click-to-call V1** : protocole `tel:` + widget custom React (timer + modale résultat)
- **Click-to-call V2 (optionnel)** : Twilio Voice API ou Aircall API pour softphone WebRTC intégré navigateur
- **Notifications navigateur** : Web Push API natif pour rappels RDV/appels
- **Déploiement** : Docker Compose, prêt pour Hetzner Cloud Server CX22+
- **Langue UI** : Français suisse uniquement
- **Devise** : CHF, format suisse (séparateur milliers `'`, ex. `1'490`, `2'500`)
- **Charset** : UTF-8 partout

---

## MODÈLE DE DONNÉES (Prisma schema)

### User
```
id, createdAt, updatedAt
email, name, passwordHash
role (enum: admin, commercial)
tauxCommissionSignature (default 0.25)
tauxCommissionRenouvellement (default 0.10)
garantieMensuelle (default 2500)
forfaitFrais (default 250)
isActive
```

### Prospect
```
id, createdAt, updatedAt
raisonSociale, contactNom, contactPrenom, contactFonction
email, telephone, telephoneMobile
adresse, codePostal, ville, canton, pays (default "Suisse")
siteWeb, linkedIn, facebook, instagram
secteur (enum: resto-hotel, e-commerce, pme-b2b, artisan, cabinet-liberal, tourisme, immobilier, autre)
effectif (nullable, int)
noga (code NOGA suisse)
source (enum: fichier-import, linkedin, referral, web, autre)
statut (enum: nouveau, contacte, qualifie, rdv-pris, proposition-envoyee, signe, perdu, ne-pas-rappeler)
scoreInteret (1 à 5)
assigneAId (FK User)
notesGenerales (text)
```

### Activity
```
id, createdAt, updatedAt
prospectId (FK), userId (FK)
type (enum: appel-sortant, appel-entrant, email-envoye, email-recu, rdv-physique, rdv-visio, rdv-telephonique, sms, linkedin, note)
date (datetime)
duree (minutes, nullable)
sujet (string), contenu (text nullable)
statut (enum: planifie, en-cours, fait, manque, replanifie, annule)
resultat (enum nullable, valide pour les appels et RDV : rdv-pris, refus-poli, refus-ferme, combox, ne-decroche-pas, invalide, deja-client, a-rappeler, mauvaise-personne, interesse-pas-pret, autre)
notesResultat (text, le qualitatif libre saisi après l'appel)
prochaineActivityId (FK Activity nullable, lien vers le rappel planifié auto)
rappelLeDe (FK Activity nullable, lien vers l'activité qui a généré ce rappel)
duree2 (int, durée réelle de l'appel en secondes, mesurée par le widget)
```

(`prochaineActivityId` et `rappelLeDe` permettent de retracer la chaîne complète de relances sur un prospect)

### Deal
```
id, createdAt, updatedAt
prospectId (FK), assigneAId (FK)
titre, description
montantPrevu (decimal, valeur 1 an attendue)
stage (enum: decouverte, proposition, negociation, signe, perdu)
probabilite (0-100)
closeAttenduLe (date), closeReelLe (date nullable)
raisonPerte (text nullable)
productsProposes (relation many-to-many avec Product)
```

### Product
```
id, nom, description
type (enum: one-shot, recurrent-mensuel, recurrent-annuel, pack)
categorie (enum: site, rs, seo, ads, cmo, metricool, pack)
prixOneShot (decimal nullable)
prixMensuel (decimal nullable)
prixAnnuel (decimal nullable)
composantsIds (pour les packs, JSON array de Product.id)
```

### Contract
```
id, createdAt, updatedAt
prospectId (FK), dealId (FK nullable), assigneAId (FK)
numero (auto: ACLR-2026-XXXX)
dateSignature, dateDebut, dureeMois (default 12)
statut (enum: actif, suspendu, resilie, expire)
montantOneShot, montantMensuel
valeurAn1 (computed: montantOneShot + montantMensuel * 12)
modalitePaiement (enum: 50-50, 100-au-signing, mensuel)
dateResiliation (date nullable), raisonResiliation (text nullable)
products (relation many-to-many)
```

### Payment
```
id, createdAt
contractId (FK)
date (date), montant (decimal)
type (enum: acompte, solde, mensualite)
statut (enum: en-attente, encaisse, en-retard)
referenceFactureClient (string)
```

### Commission
```
id, createdAt, updatedAt
contractId (FK), userId (FK)
montantTotal (computed: contract.valeurAn1 * user.tauxCommissionSignature)
montantPart1 (montantTotal / 2, à la signature)
montantPart2 (montantTotal / 2, étalé sur 11 mois)
statut (enum: due, partiellement-versee, integralement-versee, annulee)
```

### CommissionPayment
```
id, createdAt
commissionId (FK)
montant (decimal), dateVersement (date)
typePart (enum: signature, etalement-mois-1 ... etalement-mois-11, renouvellement)
statut (enum: prevu, paye, annule)
invoiceId (FK Invoice nullable, lié à la facture mensuelle)
```

### Renewal
```
id, createdAt
contractId (FK)
dateRenouvellement (date)
statut (enum: a-venir, renouvele, non-renouvele)
commissionAn2Mensuelle (computed: contract.montantMensuel * 0.10)
```

### Invoice
```
id, createdAt
userId (FK, la commerciale qui facture)
mois (date, 1er du mois)
montantCommissions (somme des CommissionPayment du mois)
montantGarantieAbsorbee (= MAX(0, 2500 - montantCommissions))
montantFrais (default 250)
montantTotal (= MAX(montantCommissions, 2500) + 250)
statut (enum: brouillon, envoyee, payee)
referenceFacture (auto: SOPHIE-2026-XX)
```

### EmailTemplate
```
id, nom, type
objet, contenu (avec variables {{prenomContact}}, {{raisonSociale}}, etc.)
```

### Email (Tous les emails envoyés/reçus depuis le CRM — vision 360)
```
id, createdAt, updatedAt
prospectId (FK, nullable si pas encore associé)
contractId (FK, nullable, pour suivi post-signature)
userId (FK, expéditeur côté ACLR pour les sortants, destinataire côté ACLR pour les entrants)
direction (enum: sortant, entrant)
threadId (string, identifiant conversation pour grouper les échanges)
messageId (string unique, RFC 5322 Message-ID)
inReplyTo (string nullable, Message-ID du parent pour reconstituer le fil)
expediteurEmail, expediteurNom
destinataireEmail (string, peut contenir plusieurs séparés par virgule)
cc, bcc (string nullable)
objet
contenuHtml (text, version HTML rendue)
contenuTexte (text, version plain text)
statut (enum: brouillon, envoye, livre, ouvert, clique, repondu, rebond, erreur)
envoyeLe (datetime nullable)
livreLe, ouvertLe, cliqueLe (datetime nullables, via webhooks Resend)
templateUtiliseId (FK EmailTemplate nullable)
attachments (relation hasMany EmailAttachment)
labels (string array, optionnel, ex. ["cold-1", "relance"])
```

### EmailAttachment
```
id, createdAt
emailId (FK)
nom (string)
taille (int, bytes)
mimeType (string)
url (string, stockage S3-compatible ou local)
```

### ClientInvoice (Facture émise par ACLR Sàrl vers le client signé)
```
id, createdAt, updatedAt
contractId (FK)
numero (auto: ACLR-CLI-{YYYY}-{NNNN})
dateEmission, dateEcheance (default emission + 30 jours)
type (enum: acompte, solde, mensualite, annuelle, ponctuelle)
periodeMoisDebut, periodeMoisFin (pour les récurrents)
lignes (relation hasMany ClientInvoiceLine)
sousTotal, totalTVA, total
statut (enum: brouillon, envoyee, payee, en-retard, annulee)
datePaiement (nullable)
referenceVirement (nullable)
modeReglement (enum: virement, twint, carte, especes)
notesClient (text, mention "Merci de votre confiance" etc.)
```

### ClientInvoiceLine (Ligne de facture client)
```
id
clientInvoiceId (FK)
designation (string, ex. "Pack Premium - Site web + RS + SEO + Ads + CMO")
quantite (decimal, default 1)
prixUnitaire (decimal)
montantHT (computed)
tauxTVA (default 0 tant que pas assujetti, sinon 0.081)
ordre (int)
productId (FK Product nullable, lien optionnel)
```

### ContractOption (Options et add-ons sur un contrat)
```
id, createdAt
contractId (FK)
designation (string, ex. "Maintenance premium +24/7", "Ajout 5 pages au site")
type (enum: one-shot, recurrent-mensuel, recurrent-annuel)
montant (decimal)
actif (boolean, true par défaut)
dateDebut, dateFin (nullable)
```

### Signature (Demande et suivi de signature électronique)
```
id, createdAt, updatedAt
contractId (FK)
type (enum: signature-electronique, signature-manuelle-pdf)
statut (enum: brouillon, envoyee, signee-client, signee-aclr, completee, refusee, expiree)
lienSignature (string, URL unique tokenisée)
signeParClient (boolean), dateSignatureClient (datetime nullable)
signeParAclr (boolean), dateSignatureAclr (datetime nullable)
ipClient (string nullable)
documentPdfUrl (string, PDF généré contrat + grille)
documentSigneUrl (string nullable, PDF avec signatures)
expireA (datetime, default emission + 14 jours)
```

### Stat (Snapshot quotidien des KPIs par commerciale)
```
id, date (date)
userId (FK)
nbAppelsSortants, nbAppelsEntrants, nbAppelsTotal
nbEmailsEnvoyes, nbEmailsRecus
nbRdvPlanifies, nbRdvHonores, nbRdvManques
nbPropositionsEnvoyees
nbContratsSignes, montantContratsSignes
nbProspectsNouveaux, nbProspectsContactes
montantRenouvellementsEncaisses
tauxConversionAppelRdv, tauxConversionRdvSignature
```

(Stat est recalculé chaque nuit via un job CRON pour servir les graphes historiques)

### Objective (Objectifs commerciaux fixés par commerciale)
```
id, createdAt, updatedAt
userId (FK)
periode (enum: hebdomadaire, mensuel, trimestriel, annuel)
dateDebut, dateFin
nbAppelsObjectif (int)
nbEmailsObjectif (int, optionnel)
nbRdvObjectif (int)
nbPropositionsObjectif (int, optionnel)
nbSignaturesObjectif (int)
caObjectif (decimal, montant CA HT signé visé)
commissionObjectif (decimal, commission visée)
notes (text)
isActif (boolean)
```

(Permet de fixer 1 objectif mensuel + 1 objectif annuel par défaut, mais évolutif)

### SalaryForecast (Prévision de salaire/facture mensuelle)
```
id, createdAt
userId (FK)
mois (date, 1er du mois projeté)
type (enum: realise, en-cours, previsionnel)
commissionsEncaisseesMois (decimal, déjà acquis)
commissionsRestantesMois (decimal, à encaisser avant fin du mois selon échéancier)
commissionsRenouvellementMois (decimal, attendues sur le mois)
montantGarantieAttendue (decimal, 0 si commissions > 2500, sinon 2500 - commissions)
montantFraisAttendu (decimal, default 250)
totalPrevu (decimal, computed)
```

(Recalculé en temps réel via une fonction Prisma, pas stocké en base — vue dérivée)

---

## RÈGLES MÉTIER À IMPLÉMENTER EXACTEMENT

### Calcul commission signature
- À la création d'un Contract en statut `actif`, créer 12 CommissionPayment :
  - 1 payment de typePart `signature` avec montant = `commission.montantTotal / 2`
  - 11 payments de typePart `etalement-mois-1` à `etalement-mois-11`, chacun = `commission.montantTotal / 22`
- Statut initial : `prevu`
- Les versements `signature` passent à `paye` quand le 1er Payment client est encaissé
- Les versements `etalement-mois-X` passent à `paye` selon la date courante (1 par mois après signature)

### Calcul commission renouvellement
- À la date d'anniversaire du contrat, si renouvelé : créer 12 CommissionPayment `renouvellement`, un par mois, chacun = `contract.montantMensuel * 0.10`
- Déclenchement à l'encaissement de chaque mensualité

### Résiliation anticipée
- Si Contract passe à `resilie` avant la fin de an 1 :
  - Tous les CommissionPayment encore `prevu` passent à `annule`
  - Les `paye` restent acquis

### Garantie absorbable (calcul mensuel)
- Pour chaque mois, à la fin du mois (CRON) :
  - Sommer tous les CommissionPayment `paye` de la commerciale ce mois → `montantCommissions`
  - Créer une Invoice :
    - Si `montantCommissions < 2500` → `montantGarantieAbsorbee = 2500 - montantCommissions`, `montantTotal = 2500 + 250 = 2750`
    - Sinon → `montantGarantieAbsorbee = 0`, `montantTotal = montantCommissions + 250`

### Numérotation
- Contrats : `ACLR-{YYYY}-{NNNN}` séquentiel par année
- Factures Sophie (interne) : `SOPHIE-{YYYY}-{NN}` séquentiel par année
- Factures clients (externe) : `ACLR-CLI-{YYYY}-{NNNN}` séquentiel par année

### Click-to-call et workflow appel sortant

**Déclenchement de l'appel :**
- Tout numéro de téléphone affiché dans l'app (fiche prospect, ligne d'activité, dashboard, agenda) est cliquable
- Au clic, deux comportements selon le device :
  - Mobile : utilise le protocole `tel:` qui ouvre le dialer natif iOS/Android
  - Desktop : ouvre le dialer Skype/Teams/Webex par défaut OU un widget interne (V1) OU un softphone WebRTC intégré (V2 avec Twilio Voice)
- Au moment du clic, une Activity de type `appel-sortant` est créée immédiatement en statut `en-cours` avec timestamp de début
- Un widget flottant "Appel en cours" apparaît en bas à droite de l'écran avec :
  - Nom du prospect appelé + numéro
  - Compteur de durée en temps réel
  - Bouton "J'ai raccroché" (action principale)

**Popup résultat d'appel (au clic sur "J'ai raccroché") :**
Modale obligatoire avec :
- Sélection rapide du résultat (boutons radio gros + intuitifs) :
  - **RDV pris** (vert) → ouvre directement le formulaire de prise de RDV (date + heure + type physique/visio/téléphonique)
  - **Refus poli** (gris)
  - **Refus ferme** (rouge → marque le prospect statut `ne-pas-rappeler`)
  - **Combox / Répondeur** (orange)
  - **Ne décroche pas** (orange)
  - **Numéro invalide** (rouge → champ téléphone marqué erroné sur la fiche prospect)
  - **Déjà client / concurrent** (gris)
  - **À rappeler** (bleu)
  - **Intéressé mais pas prêt** (bleu)
  - **Mauvaise personne** (gris → demande à corriger la fiche contact)
  - **Autre** (champ libre)
- Champ "Notes" libre (résumé verbal de l'appel)
- Durée réelle (auto-remplie depuis le widget, modifiable)

**Planification du rappel (suite de la modale) :**
Si le résultat est `combox`, `ne-decroche-pas`, `a-rappeler`, ou `interesse-pas-pret`, la modale propose :
- Boutons rapides :
  - **Rappeler J+1** (demain à la même heure)
  - **Rappeler J+2**
  - **Rappeler J+3**
  - **Rappeler J+7** (dans 1 semaine)
  - **Rappeler J+14** (dans 2 semaines)
  - **Rappeler J+30** (dans 1 mois)
- OU **Choisir une date/heure manuellement** (date picker + time picker)
- Au valider, création automatique d'une Activity de type `appel-sortant`, statut `planifie`, à la date choisie, liée à l'activité parente via `rappelLeDe`
- Cette nouvelle Activity apparaît automatiquement dans :
  - L'agenda de la commerciale (au bon créneau)
  - Le dashboard "Vue du jour" du jour J de l'appel
  - La timeline du prospect

**Cas spéciaux :**
- Si résultat = `RDV pris` : pas de rappel automatique, le RDV programmé est créé directement dans l'agenda
- Si résultat = `Refus ferme` : le prospect passe en statut `ne-pas-rappeler`, plus aucun rappel possible (avec validation explicite)
- Si résultat = `Numéro invalide` : alerte visuelle persistante sur la fiche prospect tant que le numéro n'est pas corrigé

**Compteur appels du jour :**
Chaque fermeture de modale incrémente le compteur d'appels du jour pour la commerciale, visible en temps réel dans le dashboard avec barre de progression vs objectif quotidien.

### Génération automatique d'activités depuis les emails
À chaque création d'un Email (sortant ou entrant), une Activity correspondante est créée automatiquement :
- type = `email-envoye` ou `email-recu`
- prospectId = Email.prospectId
- userId = Email.userId
- date = Email.envoyeLe
- sujet = Email.objet
- contenu = aperçu (200 premiers caractères de Email.contenuTexte)
- statut = `fait`
- lien vers Email.id pour ouvrir le détail complet

Ainsi la timeline du prospect contient TOUS les touchpoints sans avoir à logger manuellement.

### Génération automatique des factures clients
À la création d'un Contract en statut `actif` :
- Si modalité = `50-50` : créer 2 ClientInvoice (acompte 50%, solde 50% à la livraison)
- Si modalité = `100-au-signing` : créer 1 ClientInvoice 100% à la signature
- Si modalité = `mensuel` : créer 12 ClientInvoice mensualités (au 1er de chaque mois)

### Snapshot statistiques quotidien
- Job CRON à 02:00 chaque nuit qui calcule un enregistrement Stat par commerciale active
- Permet les graphiques d'évolution historique sans recalcul à chaque requête

---

## MODULES / PAGES

### Authentification (/login)
NextAuth Credentials, redirige vers Dashboard. Logout dans le menu utilisateur.

### Dashboard (/) — Vue mensuelle synthétique
> Pour la vue opérationnelle quotidienne, voir `/aujourd-hui` qui est la vraie page de démarrage de la commerciale.

**Vue commerciale (Sophie) :**
- **Bandeau Objectifs du mois** (5-6 progress bars) : appels, RDV, signatures, CA, commission — atteinte en % avec code couleur
- KPI du mois : signatures (nb + montant), commissions encaissées, **salaire prévu fin de mois**, garantie active oui/non
- Graphique : évolution commissions sur 12 mois avec ligne d'objectif
- **Bloc Prévisions** : salaire prévu ce mois, M+1, M+2, M+3 (vue 4 mois rapide)
- Pipeline visuel : 5 cards par stage avec total montant + montant pondéré
- Activités du jour (planifiées + à faire)
- Top 5 deals les plus chauds (score + probabilité)
- **Renouvellements ce mois et le mois prochain** (avec montants attendus)
- **Boîte mail rapide** : 3 dernières conversations actives, non lus en exergue
- Alertes : renouvellements dans les 60 jours, deals stagnants, emails sans réponse > 7 jours

**Vue admin (Arthur) :**
- Tout ce qui précède
- + Total CA agence du mois (vs objectif annuel ACLR)
- + Montant à verser aux commerciales ce mois (et prévision M+1, M+2)
- + CA récurrent total agence (vue mensuelle et annuelle)
- + Liste des contrats récents et taux de conversion par étape par commerciale

### Prospects (/prospects)
- Tableau filtrable (raison sociale, contact, email recherche full-text)
- Filtres : statut, secteur, canton, score, assignéA
- Tri sur toutes les colonnes
- Pagination serveur (50 par page)
- **Import CSV** : page dédiée `/prospects/import`
  - Upload fichier
  - Mapping colonnes (assistant qui détecte automatiquement)
  - Aperçu 10 premières lignes
  - Validation Zod par ligne
  - Import par batch (transaction Postgres)
  - Rapport : X importés, Y erreurs, télécharger CSV des erreurs
- Export CSV de la sélection
- Détail prospect `/prospects/[id]` :
  - Toutes les infos (édition inline)
  - Timeline d'activités triée par date desc
  - Liste deals associés
  - Liste contrats signés
  - Bouton "Logger appel" (formulaire rapide avec durée, résultat, prochaine action)
  - Bouton "Logger email" (sujet, contenu)
  - Bouton "Créer deal" (wizard)
  - Bouton "Marquer comme..." (dropdown statut)

### Pipeline (/pipeline)
- Vue Kanban drag & drop avec 5 colonnes (stages)
- Cartes deals avec : raison sociale, montantPrevu, closeAttenduLe, score
- Total montant par colonne en header
- Filtre par commerciale, secteur, période
- Clic carte ouvre detail deal en sidebar
- Drag d'une colonne à une autre = changement de stage

### Activités (/activites)
- Liste filtrable par date, type, statut, commerciale
- Vue alternative calendrier (semaine/mois)
- Création rapide depuis bouton flottant
- Marquage `fait` en un clic
- Replanification rapide

### Catalogue produits (/catalogue)
- CRUD admin uniquement
- Liste produits + packs
- Visualisation composition des packs
- Édition prix in-place

### Contrats (/contrats)
- Tableau : numéro, prospect, valeurAn1, statut, dateSignature, commerciale
- Filtres : statut, période, commerciale
- Création depuis Deal `signe` : wizard
  - Étape 1 : sélection prospect + deal
  - Étape 2 : sélection produits + quantités → calcul automatique valeurAn1
  - Étape 3 : modalité paiement + dates
  - Étape 4 : récap + commission auto-calculée + bouton créer
- Détail contrat :
  - Infos générales
  - Planning paiements (table : date, montant, type, statut)
  - Planning commissions (table : date, montant, typePart, statut)
  - Bouton "Enregistrer paiement reçu"
  - Bouton "Résilier contrat"

### Paiements (/paiements)
- Liste filtrable de tous les paiements client
- Bouton "Enregistrer paiement" depuis un contrat
- Au passage à statut `encaisse` : déclenche automatiquement les versements de commissions correspondants

### Commissions (/commissions)
- Vue commerciale : ses commissions, montants total/versé/à venir
- Calendrier des versements à venir (mois par mois)
- Vue admin : commissions de toute l'équipe

### Factures Sophie (/factures)
- Liste des factures mensuelles
- Génération automatique au 1er du mois suivant (job CRON)
- Génération manuelle possible
- Aperçu détaillé : commissions du mois + garantie + frais = total
- Export PDF (template avec coordonnées ACLR Sàrl + Sophie + IBAN)
- Marquage `envoyee` → `payee`

### Renouvellements (/renouvellements)
- Liste contrats arrivant à échéance 90 jours
- Statut visuel (vert si renouvellement confirmé, orange si en attente, rouge si non renouvelé)
- Action "Renouveler" : crée les CommissionPayment renouvellement
- Action "Ne pas renouveler" : statut + raison

### Emails (/emails) — Boîte mail intégrée vision 360
**Tous les emails envoyés ET reçus passent par le CRM. Aucun email ne disparaît dans une boîte privée.**

**Configuration technique :**
- **Sortants** : envoi via API Resend (compte ACLR). Chaque email envoyé depuis le CRM est sauvegardé en base avec son contenu intégral.
- **Entrants** : adresse de réception unique gérée par le CRM (ex. `prospects@aclr.ch` ou alias `inbox+{tokenProspect}@aclr.ch`). 
  - Méthode A (recommandée V1) : règle de forward Gmail sur la boîte de Sophie qui forwarde automatiquement tout email entrant à l'adresse CRM, le CRM parse via webhook Resend Inbound et rattache au prospect via le sender email
  - Méthode B (V2) : intégration directe Gmail API / Microsoft Graph API pour sync deux sens en temps réel
- Threading automatique via `Message-ID` et `In-Reply-To` (RFC 5322)
- Tracking ouvertures et clics via pixel tracking + URL wrapping (webhooks Resend)

**Vue 1 — Boîte de réception unifiée :**
- Liste de tous les emails (sortants + entrants) toutes commerciales confondues pour l'admin
- Vue commerciale : ses propres conversations + celles des prospects qui lui sont assignés
- Filtres : non lu, lu, en attente de réponse, rebond, par prospect, par template utilisé
- Recherche full-text dans objet + contenu

**Vue 2 — Conversation (thread) :**
- Affichage style Gmail : fil chronologique, derniers messages en bas
- Bulles distinctes pour sortants (côté droit, couleur primaire) et entrants (côté gauche, gris)
- Métadonnées : date/heure, statut (livré, ouvert, cliqué)
- Pièces jointes téléchargeables
- Bouton "Répondre" qui pré-remplit l'objet `Re:` et conserve le threadId

**Vue 3 — Email depuis fiche prospect :**
- Onglet "Emails" dans `/prospects/{id}` qui liste toutes les conversations avec ce prospect
- Quel membre de l'équipe a envoyé/répondu (avatar + nom)
- Bouton "Nouveau message" depuis la fiche prospect : pré-rempli avec le destinataire

**Composition d'email :**
- Éditeur WYSIWYG (Tiptap ou similaire)
- Variables auto-remplies depuis le prospect (`{{prenomContact}}`, `{{raisonSociale}}`, `{{ville}}`)
- Application d'un template en 1 clic depuis la bibliothèque
- Aperçu avec rendu réel avant envoi
- Pièces jointes (drag & drop, max 25 Mo total)
- Signature email personnalisée par utilisateur (config dans Paramètres)
- Bouton "Envoyer" → l'email part via Resend ET est sauvegardé immédiatement dans le CRM avec statut `envoye`
- Webhooks Resend mettent à jour les statuts `livre`, `ouvert`, `clique`, `rebond`

**Templates emails (sous-section ou onglet) :**
- Bibliothèque par type (cold-1, cold-2-relance, post-rdv, post-proposition, etc.)
- Éditeur WYSIWYG simple
- Variables disponibles auto-complétion
- Aperçu rendu avec un prospect réel
- Bouton "Utiliser comme nouveau message"

**Tracking et stats des emails (intégré au module Statistiques) :**
- Taux d'ouverture par template
- Taux de clic
- Taux de réponse
- Temps moyen avant réponse
- A/B testing entre versions de templates

### Aujourd'hui (/aujourd-hui) — Vue du jour
**LA page d'accueil opérationnelle de Sophie. Cockpit unique pour piloter sa journée.**

**Bandeau objectifs du jour (en haut, sticky) :**
- Compteurs en temps réel avec progress bars :
  - Appels passés : 12 / 20 prévus aujourd'hui
  - Emails envoyés : 8 / 15
  - RDV honorés : 1 / 3
  - Propositions envoyées : 0 / 1
- Couleur changeant selon avancement (rouge < 50%, orange 50-80%, vert ≥ 80%)
- Encouragement contextuel ("Plus que 8 appels pour atteindre l'objectif !")

**Liste "À faire aujourd'hui" (centre, principal) :**
Triée par heure planifiée, avec pour chaque ligne :
- Heure du créneau
- Type (icône) : appel, email, RDV
- Nom prospect + raison sociale (cliquable → fiche)
- Téléphone cliquable (déclenche click-to-call)
- Bouton action principal : "Appeler maintenant" / "Voir RDV" / "Envoyer email"
- Bouton secondaire : "Replanifier"

**Sections de la liste :**
1. **En retard** (en rouge en haut) : tout ce qui était prévu hier ou avant et pas fait
2. **Maintenant** (créneau actuel) : ce qui est prévu dans l'heure
3. **Ce matin / cet après-midi / ce soir** : le reste de la journée
4. **Demain** (preview) : les 3-5 prochains items de demain pour anticipation

**Sidebar droite :**
- Mini-calendrier de la semaine avec densité d'activités par jour
- Compteurs hebdo : appels semaine 47 / 100, signatures 1 / 5
- Bouton "+ Ajouter une tâche / appel / RDV"

**Raccourcis clavier :**
- `Espace` ou `Enter` : marquer la prochaine tâche comme `fait`
- `c` : passer un appel sur le prochain prospect listé
- `r` : ouvrir la modale de replanification

### Agenda (/agenda)
**Vue calendaire complète pour la planification avancée.**
- Vue calendrier semaine et mois (par défaut semaine)
- Vue liste filtrable par jour
- Drag & drop pour replanifier
- Codes couleur : appel sortant (bleu), RDV physique (vert), RDV visio (violet), follow-up (orange), rappel auto (cyan)
- Création rapide d'événement depuis un clic sur un créneau libre
- Synchronisation Google Calendar / Outlook (v2 optionnel)
- Rappels avant RDV (notif navigateur 15 min avant)
- Pour chaque événement : bouton "Marquer fait" / "Marquer manqué" / "Replanifier" en un clic
- Lien direct vers la fiche prospect
- Filtre "Cacher les fait" pour voir ce qui reste

### Statistiques (/stats)
**Tableau de bord analytique commercial.**
- Filtres période : 7 jours, 30 jours, 90 jours, mois, trimestre, année, custom
- Filtre commerciale (admin only)

**Section Objectifs vs Réalisé (en haut, toujours visible) :**
- Gauges/Progress bars pour chaque objectif de la période :
  - Appels : 142 / 200 (71%)
  - Emails envoyés : 89 / 100 (89%)
  - RDV : 12 / 20 (60%)
  - Propositions : 8 / 15 (53%)
  - Signatures : 3 / 5 (60%)
  - CA signé : CHF 18'500 / CHF 30'000 (62%)
  - Commission : CHF 4'625 / CHF 7'500 (62%)
- Code couleur : rouge < 50%, orange 50-80%, vert ≥ 80%
- Vitesse de progression vs jours restants dans la période

**Section Activité :**
- Nombre d'appels sortants (graphique courbe quotidien) + comparaison à l'objectif quotidien dérivé
- Nombre d'emails envoyés (graphique)
- Nombre de RDV planifiés vs honorés (taux de noshow)
- Heatmap des activités par jour/heure

**Section Conversion :**
- Funnel visuel : Prospects → Contactés → RDV pris → RDV honorés → Propositions → Signatures
- Taux de conversion à chaque étape avec comparaison période précédente
- Taux de signature moyen (% des propositions qui signent)
- Délai moyen entre 1er contact et signature
- "Effort pour 1 signature" : combien d'appels / emails / RDV en moyenne pour 1 signature

**Section Performance financière :**
- CA signé sur la période (courbe cumulative vs objectif)
- Commission générée
- Top 5 contrats du mois
- Comparaison période précédente (% évolution)

**Section Renouvellements et revenu récurrent :**
- CA récurrent encaissé sur la période (commissions 10% générées)
- Calendrier des renouvellements sur les 12 prochains mois
- Taux de renouvellement (% des contrats arrivant à échéance qui renouvellent)
- Churn rate mensuel

**Section Pipeline :**
- Montant total pipeline par stage
- Probabilité pondérée du pipeline (somme montant * probabilité)
- Vieillissement du pipeline (deals stagnants depuis X jours)

**Section Secteurs et géographie :**
- Répartition signatures par secteur (pie chart)
- Répartition par canton (carte ou bar chart)

Export PDF du rapport pour reporting hebdomadaire.

### Prévisions salaire & commission (/previsions)
**Vue forward-looking pour la commerciale et pour Arthur.**

**Bloc 1 — Salaire prévu du mois en cours :**
- Commissions déjà encaissées ce mois : CHF X
- Commissions attendues d'ici la fin du mois (versements étalés programmés) : CHF Y
- Commissions de renouvellement attendues : CHF Z
- Total commissions prévues : CHF X+Y+Z
- Garantie absorbable activée : oui/non (et montant)
- Forfait frais : CHF 250
- **Facture mensuelle estimée : CHF (max(X+Y+Z, 2500) + 250)**
- Mise à jour en temps réel selon les paiements clients qui rentrent

**Bloc 2 — Prévisions sur 12 mois :**
- Tableau ligne par ligne, un mois par ligne :
  - Mois M+1 : commissions étalées prévues + renouvellements attendus = total estimé
  - Mois M+2 : idem
  - ...
  - Mois M+12 : idem
- Total cumulé 12 mois (salaire annuel projeté)
- Code couleur : mois où la garantie absorbera (orange), mois en performance pure (vert)

**Bloc 3 — Décomposition du portefeuille récurrent :**
- Liste des contrats récurrents actifs apportés par la commerciale
- Montant mensuel encaissé par contrat
- Date de renouvellement attendue
- Commission renouvellement mensuelle générée (10%)
- Total revenu de fond garanti tant que les clients restent

**Bloc 4 — Pipeline pondéré (CA potentiel à venir) :**
- Pour chaque deal en stage `proposition` ou `negociation` :
  - Montant
  - Probabilité (%)
  - Montant pondéré = montant × probabilité
  - Commission potentielle à 25%
- Total pipeline pondéré → commission potentielle additionnelle

**Bloc 5 — Atteinte annuelle :**
- Salaire cumulé année en cours
- Objectif annuel (depuis Objective)
- Reste à faire pour atteindre l'objectif
- Mois moyen nécessaire pour atteindre l'objectif

### Renouvellements (/renouvellements) [enrichi]
**Suivi calendaire des renouvellements automatiques.**

**Vue mensuelle :**
- Calendrier du mois en cours et 2 mois suivants
- Pour chaque contrat arrivant à échéance dans la fenêtre :
  - Carte client + date exacte
  - Montant mensuel récurrent
  - Commission renouvellement attendue (10%/mois × 12)
  - Statut : à confirmer / confirmé / non renouvelé
  - Bouton "Renouveler" (déclenche création CommissionPayment renouvellement an 2)
  - Bouton "Ne pas renouveler" (raison + désactivation)
- Total montant attendu sur le mois
- Total commission renouvellement attendue sur le mois

**Vue annuelle :**
- Tableau 12 mois × clients avec montants attendus
- Synthèse : 
  - Total revenu récurrent annuel
  - Total commissions renouvellement annuelles
  - Évolution mois après mois (graphique aire)
- Export Excel du planning des renouvellements
- Alertes : renouvellements à risque (clients en retard de paiement, baisse d'utilisation, etc.)

**Stats renouvellement :**
- Taux de renouvellement global (12 derniers mois)
- LTV moyen client (en mois)
- Churn rate mensuel et trimestriel

### Factures clients (/factures-clients)
**Émission des factures de ACLR Sàrl vers les clients signés.**
- Liste filtrable (statut, période, client, contrat)
- Génération automatique au moment du contrat (acompte + solde, ou mensualités)
- Génération manuelle ponctuelle
- Édition lignes : produits ou texte libre, quantité, prix unitaire, TVA optionnelle
- Aperçu PDF en temps réel
- Export PDF (template ACLR Sàrl avec logo, IBAN, conditions de paiement, mention TVA)
- Envoi par email au client (intégration Resend en v2)
- Tracking statut : brouillon → envoyée → payée
- Relances automatiques sur factures en retard (J+7, J+15, J+30)
- Marquage paiement reçu → déclenche les commissions correspondantes
- Génération du livre des factures (export Excel pour la comptabilité)

### Objectifs (/objectifs)
**Définition et suivi des objectifs commerciaux par commerciale.**
- Vue commerciale : ses propres objectifs + progression temps réel
- Vue admin : fixer/modifier les objectifs des commerciales

**Création d'objectif :**
- Sélection commerciale
- Sélection période (hebdo, mensuel, trimestriel, annuel)
- Saisie objectifs chiffrés :
  - Nombre d'appels
  - Nombre d'emails (optionnel)
  - Nombre de RDV
  - Nombre de propositions envoyées (optionnel)
  - Nombre de signatures
  - CA signé (montant CHF)
  - Commission visée (montant CHF)
- Notes / contexte

**Templates suggérés (à proposer en seed) :**
- Objectif mensuel "Démarrage" (mois 1-3) : 200 appels, 15 RDV, 2 signatures, CHF 10'000 CA
- Objectif mensuel "Croisière" (mois 4-9) : 250 appels, 25 RDV, 4 signatures, CHF 20'000 CA
- Objectif mensuel "Performance" (mois 10+) : 300 appels, 30 RDV, 6 signatures, CHF 35'000 CA
- Objectif annuel : 3'000 appels, 300 RDV, 50 signatures, CHF 300'000 CA, CHF 75'000 commission

**Suivi d'objectif :**
- Progress bar par axe avec pourcentage
- Projection "à ce rythme, j'atteindrai X% à la fin de la période"
- Vitesse requise quotidienne pour atteindre l'objectif (ex : "il te reste 12 jours et 78 appels à passer, soit 6.5/jour")
- Comparaison à la même période précédente
- Bouton "Dupliquer comme objectif du mois suivant"

### Signature électronique (/signatures)
**Workflow de signature des contrats.**
- Liste des contrats en attente de signature
- Création d'une demande de signature depuis un contrat
- Génération automatique du PDF :
  - Page 1-2 : modalités du contrat (issu du wizard contrat)
  - Page 3 : grille tarifaire détaillée
  - Page 4 : conditions générales ACLR Sàrl
  - Page 5 : zones de signature (client + ACLR Sàrl)
- Envoi par email au client avec lien unique tokenisé sécurisé
- Page publique de signature (/sign/{token}) :
  - Aperçu du contrat
  - Champ signature dactylographiée OU signature dessinée à la souris/tactile
  - Acceptation explicite des CGV (case à cocher)
  - Validation IP + timestamp
- Notification commerciale à la signature
- Bouton "Contre-signer ACLR Sàrl" pour Arthur dans /signatures
- Contrat signé : statut Contract passe automatiquement à "actif" + déclenche les CommissionPayment
- Stockage PDF signé final accessible côté ACLR et côté client (relien email)
- **V2 optionnel** : intégration Yousign API pour signature qualifiée eIDAS

### Paramètres (/parametres)
- Profil utilisateur (changer email, mdp, nom)
- Paramètres ACLR (admin only) :
  - Logo
  - Coordonnées factures
  - IBAN
  - Taux commission par défaut
  - Garantie mensuelle
  - Forfait frais

---

## UX / UI

- Design moderne, sobre, professionnel
- Palette suggérée : bleu marine `#1F4E78` (primaire) + orange doux `#FB923C` (accent) + gris neutre shadcn
- Mobile-friendly impératif (Sophie prospecte en mobilité)
- Sidebar gauche fixe sur desktop, drawer hamburger sur mobile
- Raccourcis clavier :
  - `g p` → prospects
  - `g d` → dashboard
  - `n` → nouveau prospect
  - `/` → focus barre de recherche globale
- Recherche globale (Cmd+K) : prospects, deals, contrats
- Toasts pour confirmations (sonner)
- Confirmations modales sur actions destructrices
- Loading skeletons sur les listes
- Empty states avec illustrations sobres + CTA

---

## SÉCURITÉ

- Toutes les mutations passent par Server Actions Next.js
- Validation Zod systématique
- Row-level security : un commercial ne voit que ses propres prospects assignés et ses propres deals (sauf admin)
- Hash bcrypt sur mots de passe
- CSRF protection NextAuth
- Rate limiting sur login
- Variables sensibles dans `.env` (jamais commitées) :
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `RESEND_API_KEY` (pour les emails sortants et webhooks inbound)
  - `RESEND_INBOUND_TOKEN` (validation des webhooks entrants)
  - `STORAGE_S3_*` (pour les pièces jointes emails et PDFs contrats)
- Backup quotidien Postgres via script CRON dans le compose

---

## ÉTAPES DE CONSTRUCTION

Construis dans cet ordre, en validant chaque étape avant la suivante :

1. Scaffolding Next.js + Prisma + Postgres + Docker Compose
2. Schéma Prisma complet + migration initiale + seed (2 users, 12 produits, 10 prospects exemple)
3. Auth NextAuth + middleware de protection routes
4. Layout principal (sidebar + topbar + zone contenu)
5. Module Prospects (liste + détail + édition + import CSV)
6. Module Activités lié aux prospects (incluant workflow click-to-call + modale résultat + rappel auto J+N)
7. Module "Aujourd'hui" / Vue du jour (cockpit principal de la commerciale)
8. Module Pipeline (Kanban deals)
9. Module Catalogue produits
10. Module Contrats avec wizard de création
11. Module Paiements clients
12. Moteur de calcul commissions (création automatique CommissionPayment, déclencheurs)
13. Module Commissions (visualisation)
14. Module Factures mensuelles + génération PDF + job CRON
14. Module Renouvellements
16. Dashboard avec agrégations
17. Templates emails
18. Paramètres + édition taux/garantie
19. Module Agenda (vue calendrier dédiée RDV + drag & drop replanification)
20. Module Objectifs (création + suivi + progress bars)
21. Module Statistiques (funnel + objectifs vs réalisé + graphiques + export PDF)
22. Module Prévisions salaire/commission (vue 12 mois + pipeline pondéré)
23. Module Renouvellements enrichi (vue mensuelle + annuelle + alertes)
24. Module Factures clients (émission ACLR → clients signés + PDF + tracking)
25. Module Signature électronique (PDF + lien tokenisé + page publique de signature)
26. Module Emails 360 (intégration Resend sortant + webhook inbound + threading + boîte unifiée)
27. Job CRON snapshot statistiques quotidien
28. Tests E2E Playwright sur les 10 flux critiques :
    - Importer 100 prospects depuis CSV
    - Logger 3 activités (appel, email, RDV) sur un prospect
    - Cliquer sur le téléphone d'un prospect → simuler appel + saisir résultat "Combox" + replanifier rappel J+2 → vérifier création Activity planifiée + apparition dans /aujourd-hui le J+2
    - Envoyer un email depuis le CRM, simuler un email entrant, vérifier que le thread se reconstitue et qu'une Activity auto est créée
    - Créer un deal et le faire avancer dans le pipeline jusqu'à signé
    - Générer une demande de signature électronique + signer côté client (page publique)
    - Vérifier passage automatique du contrat à `actif` après signature
    - Vérifier création des CommissionPayment + ClientInvoice acompte
    - Enregistrer un paiement → vérifier déclenchement commission
    - Générer une facture mensuelle Sophie → vérifier garantie absorbée correctement
29. README complet en français : installation locale + déploiement Hetzner Cloud
30. Documentation utilisateur (PDF généré) pour Sophie

---

## LIVRABLES FINAUX

- Repo Git avec branches `main` et `develop`
- `README.md` clair en français (install local en 1 commande, déploiement Hetzner en 5 étapes)
- `docker-compose.yml` qui démarre Postgres + Next.js + un service backup nightly
- Données seed pour démarrer (2 users, 12 produits, 10 prospects fictifs, 2 deals, 1 contrat)
- Tests E2E Playwright qui passent en CI
- Documentation utilisateur français (1 PDF guidé pour Sophie)
- Variables d'environnement documentées dans `.env.example`

---

## DÉMARRE PAR

1. **Confirme ta compréhension** des règles métier critiques :
   - Commission 25% sur valeur 1 an, versement 50/50 (signature + étalé 11 mois)
   - Commission 10% sur renouvellement an 2+
   - Garantie absorbable CHF 2'500/mois + frais CHF 250
   - Résiliation anticipée annule les versements futurs non encore payés
2. **Pose 3-5 questions** sur les zones ambiguës avant de coder
3. **Scaffold le projet** (étape 1 ci-dessus)
4. **Implémente la 1ère verticale complète** : Prospects (liste + détail + import + activités)
5. **Demande validation** avant de passer aux autres modules

Si tu hésites entre deux options techniques, choisis celle qui rend la maintenance la plus facile pour une équipe non-développeur derrière.

---

## NOTES IMPORTANTES

- L'utilisateur final n'est pas développeur. Tout doit être robuste, avec gestion d'erreurs lisibles.
- Les commissions sont une zone à zéro bug toléré : audite les calculs, ajoute des tests unitaires sur le moteur de commission.
- Le format des montants à l'affichage doit toujours être suisse : `CHF 2'500.00` (apostrophe milliers).
- Les dates en français : `28 mai 2026`, `28/05/2026` selon contexte.
- Tout en français, jamais d'anglais dans l'UI.
