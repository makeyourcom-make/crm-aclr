# Guide d'utilisation — Sophie

Ce guide t'accompagne dans ta journée type avec le CRM Make Your Com.

> Si quelque chose ne marche pas comme attendu, contacte Arthur — il y a
> toujours moyen de corriger en 2 clics dans /parametres.

---

## Première connexion

1. Va sur `https://crm.aclr.ch/login`
2. Ton email : `sophie@aclr.ch`
3. Ton mot de passe initial t'a été communiqué à part — change-le dès que possible
4. Tu arrives sur le **Dashboard** : vue d'ensemble du mois

**Conseil** : épingle l'onglet dans ton navigateur, le CRM est ton outil principal.

---

## Journée type

### 🌅 Le matin (5 min) — démarrage

1. Ouvre **`/aujourd-hui`** dans la sidebar — c'est ton cockpit
2. Le **bandeau en haut** te dit où tu en es de tes objectifs du jour :
   - 📞 Appels passés
   - ✉️ Emails envoyés
   - 📅 RDV honorés
   - 📋 Propositions envoyées
   
   Les couleurs : rouge en-dessous de 50 %, orange 50-80 %, vert au-dessus.

3. La **liste centrale** te montre dans l'ordre :
   - **En retard** (fond rougeâtre) — à traiter d'urgence
   - **Maintenant** — prévu dans l'heure
   - **Ce matin / Cet après-midi / Ce soir** — le reste de la journée
   - **Demain** — preview pour anticiper

4. **Raccourcis clavier** :
   - `c` → lance un appel sur le prochain prospect
   - `Espace` → marque la tâche courante comme faite

---

### 📞 Passer un appel (workflow click-to-call)

1. Sur ta fiche prospect, **clique sur le numéro de téléphone** (texte bleu)
2. Ton dialer s'ouvre automatiquement (mobile : iOS/Android, desktop : Skype/Teams/dialer par défaut)
3. **En bas à droite, un widget flottant apparaît** :
   - Pulse verte « Appel en cours »
   - Timer qui s'incrémente
   - Bouton bleu **« J'ai raccroché »**

4. Tu peux **continuer à naviguer** dans le CRM pendant l'appel — le widget te suit
5. **Quand tu raccroches**, clique le bouton → la modale résultat s'ouvre :

   | Résultat | Comportement |
   |---|---|
   | 🟢 RDV pris | Le RDV se planifie directement |
   | 🔴 Refus ferme | Le prospect passe en « Ne pas rappeler » |
   | 🔴 Numéro invalide | Tu auras un rappel pour corriger |
   | 🟠 Combox / Ne décroche pas | Bloc bleu « Quand rappeler ? » avec 6 boutons rapides (J+1, J+2, J+3, 1 sem., 2 sem., 1 mois) |
   | 🔵 À rappeler / Intéressé pas prêt | Idem replanification |
   | ⚪ Refus poli / Déjà client / Mauvaise personne | Pas de rappel auto |

6. Ajoute tes notes dans le champ libre, sélectionne le délai si applicable, valide.

→ Le compteur d'appels du jour s'incrémente. L'activité est dans la timeline du prospect.

---

### 👥 Travailler tes prospects

**`/prospects`** — la liste de tous tes leads en cours de prospection.

- Les statuts `SIGNÉ` sont automatiquement masqués (ils vivent dans `/contrats`)
- Filtres en haut : recherche libre, statut, secteur, canton
- Clique sur le nom d'un prospect pour ouvrir sa fiche

**Sur une fiche prospect** :
- En haut à droite : bouton **« Modifier »**
- Coordonnées avec emails et téléphones cliquables
- **Timeline activités** avec bouton **« + Logger une activité »** pour saisir un échange manuel (ex. après un échange Linkedin)

### Importer en masse

1. Clique **« Importer CSV »** en haut de `/prospects`
2. Glisse ton fichier (`.csv`, `.tsv`)
3. Le système détecte automatiquement les colonnes (raison sociale, contact, email, etc.)
4. Vérifie le mapping et l'aperçu des 5 premières lignes
5. Clique « Importer X prospects »

Les erreurs sont récupérables dans un CSV téléchargeable.

---

### 💼 Faire avancer un deal

**`/pipeline`** — vue Kanban des 5 stages :

```
Découverte → Proposition → Négociation → Signé / Perdu
   10%         40%            70%         100% / 0%
```

- **Drag & drop** : attrape une carte, glisse-la dans une autre colonne, lâche. La probabilité par défaut se met à jour.
- **Clic court sur une carte** : panneau latéral droit avec tout le détail
- **« Nouveau deal »** en haut pour créer

---

### ✍️ Créer un contrat (à la signature)

Quand un deal passe en `SIGNÉ`, transforme-le en vrai contrat :

1. **`/contrats`** → bouton **« Nouveau contrat »**
2. Wizard 4 cards :
   - **Prospect & deal** — si tu choisis un deal, le prospect s'auto-remplit
   - **Lignes du contrat** — ajoute les produits avec quantité, override prix si besoin
   - **Modalités** — 50/50 (acompte+solde), 100% à la signature, ou mensuel — + dates
   - **Récap LIVE** — valeur an 1 et commission se calculent en direct
3. Clique « Créer le contrat (CHF X'XXX) »

🎯 Ce qui se passe automatiquement :
- Numéro `ACLR-{année}-{NNNN}` assigné
- Commission 25% créée avec son plan (1 signature + 11 étalements mensuels)
- Factures clients générées (selon modalité)
- Prospect → statut SIGNÉ
- Deal (si fourni) → stage SIGNÉ

---

### 💰 Encaisser un paiement client

Quand un client te paie :

1. Va sur la fiche du contrat
2. Clique **« Enregistrer un paiement »**
3. Sélectionne la facture couverte (le montant + type se pré-remplissent)
4. Confirme

→ La facture passe en `PAYÉE`. Si c'est le **1er paiement** du contrat, la commission `SIGNATURE` passe automatiquement en « Acquise » dans tes commissions.

---

### 📊 Suivre tes commissions

**`/commissions`** — 4 KPIs :
- **Acquis YTD** (vert) — ce que tu as gagné cette année
- **Acquis ce mois** — ce qui sera dans ta prochaine facture
- **À venir** — versements PRÉVU futurs
- **Annulées** — résiliations

Le **calendrier 13 mois** te montre la répartition (vert acquis, bleu hachuré à venir).

⚠️ **Important** : « Acquise » ≠ « Versée »
- Acquise = tu as gagné le revenu, il est dans le pot du mois
- Versée = Arthur t'a fait le virement (une fois par mois)

---

### 📑 Tes factures mensuelles

**`/factures`** — tes factures mensuelles sortantes vers Arthur.

Au **1er de chaque mois**, le CRM génère automatiquement ta facture du mois précédent avec :
- Sous-total commissions acquises
- Garantie absorbée (si commissions < CHF 2'500)
- Forfait frais CHF 250
- **Total à verser** par Arthur

Tu peux :
- Télécharger le **PDF** (bouton en haut)
- La marquer **« Envoyée »** quand tu l'as envoyée par email
- Arthur la marque **« Payée »** quand il t'a viré

---

### 🔮 Prévoir tes revenus

**`/previsions`** — projection 12 mois en avant :
- Bloc 1 : salaire prévu du mois en cours
- Bloc 2 : tableau 12 mois avec étalements + renouvellements + garantie
- Bloc 3 : ton portefeuille récurrent (les contrats actifs qui tournent)
- Bloc 4 : pipeline pondéré → commission potentielle
- Bloc 5 : ton atteinte de l'objectif annuel

---

## Gestion des objectifs

**`/objectifs`** — crée tes propres objectifs :

3 templates rapides :
- **Démarrage** (mois 1-3) : 200 appels / 15 RDV / 2 sign. / CHF 10'000 CA
- **Croisière** (mois 4-9) : 250 / 25 / 4 / CHF 20'000
- **Performance** (mois 10+) : 300 / 30 / 6 / CHF 35'000

Tu peux fixer hebdo, mensuel, trimestriel ou annuel. La progression s'affiche
en temps réel dans le bandeau de `/aujourd-hui` et `/stats`.

---

## En cas de pépin

| Problème | Solution |
|---|---|
| Mot de passe oublié | Demande à Arthur de te le reset dans `/parametres` |
| Numéro téléphone d'un prospect erroné | Sur la fiche → Modifier → champ téléphone |
| Tu as marqué une activité fait par erreur | Ouvre la fiche prospect, clique sur l'activité dans la timeline → tu peux la rééditer |
| Tu veux annuler une session d'appel sans saisir un résultat | Dans la modale « J'ai raccroché », clique « Annuler la session » |
| Une facture client est mauvaise | Sur la fiche contrat, supprimer la facture brouillon puis recréer |

---

## Raccourcis rapides

| Raccourci | Action |
|---|---|
| `g p` | Aller sur Prospects |
| `g d` | Aller sur Dashboard |
| `/` | Focus barre de recherche |
| `Cmd+K` | Recherche globale (V2) |
| `c` (sur /aujourd-hui) | Appeler le prochain prospect |
| `Espace` (sur /aujourd-hui) | Marquer la prochaine tâche faite |

Bonne prospection 💪
