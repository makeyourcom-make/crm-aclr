/**
 * Constantes métier — CRM ACLR Sàrl / Make Your Com.
 *
 * Ces valeurs servent de défauts. Elles peuvent être surchargées par
 * utilisateur (champs `tauxCommissionSignature`, `garantieMensuelle`, etc.
 * sur le modèle User) et par les paramètres globaux (table Setting).
 *
 * Ne JAMAIS hardcoder ces valeurs ailleurs dans le code — toujours importer
 * d'ici et lire la surcharge utilisateur quand applicable.
 */

// ============================================================================
// COMMISSIONS
// ============================================================================

/** Taux par défaut sur la commission de signature (25 % de la valeur an 1). */
export const TAUX_COMMISSION_SIGNATURE_DEFAULT = 0.25;

/** Taux par défaut sur le renouvellement (10 % du mensuel à l'an 2+). */
export const TAUX_COMMISSION_RENOUVELLEMENT_DEFAULT = 0.1;

/**
 * Étalement du versement de commission signature.
 * 1 part à la signature + N parts mensuelles ensuite.
 */
export const COMMISSION_SIGNATURE_PART_INITIALE_DENOMINATEUR = 2; // moitié à signature
export const COMMISSION_SIGNATURE_NB_MOIS_ETALEMENT = 11;
export const COMMISSION_SIGNATURE_PART_ETALEE_DENOMINATEUR = 22; // 1/22 par mois sur 11 mois = 50 %

// ============================================================================
// GARANTIE & FORFAIT
// ============================================================================

/** Garantie mensuelle minimale (CHF) — absorbée par ACLR si commissions < seuil. */
export const GARANTIE_MENSUELLE_DEFAULT_CHF = 2500;

/** Forfait frais mensuel ajouté à la facture de la commerciale (CHF). */
export const FORFAIT_FRAIS_MENSUEL_DEFAULT_CHF = 250;

// ============================================================================
// CONTRATS
// ============================================================================

/** Durée par défaut d'un contrat en mois. */
export const CONTRAT_DUREE_MOIS_DEFAULT = 12;

/** Délai par défaut entre émission et échéance de facture client (jours). */
export const FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT = 30;

/** Délai d'expiration d'une demande de signature (jours). */
export const SIGNATURE_EXPIRATION_JOURS_DEFAULT = 14;

// ============================================================================
// NUMÉROTATION
// ============================================================================

/** Préfixes des numéros séquentiels. */
export const PREFIX_CONTRAT = "ACLR";
export const PREFIX_FACTURE_CLIENT = "ACLR-CLI";
export const PREFIX_FACTURE_SOPHIE = "SOPHIE";

// ============================================================================
// TVA
// ============================================================================

/**
 * Taux TVA suisse standard depuis 2024 : 8.1 %.
 * Par défaut ACLR Sàrl n'est PAS assujetti (CA < CHF 100k), donc taux = 0.
 * À activer dans /parametres quand le seuil sera dépassé.
 */
export const TVA_TAUX_STANDARD_CH = 0.081;
export const TVA_TAUX_DEFAULT = 0;

// ============================================================================
// CATALOGUE — PRIX TARIF STANDARD (à seeder en BDD à l'étape 2)
// ============================================================================

// ============================================================================
// OBJECTIFS QUOTIDIENS PAR DÉFAUT (utilisés tant que /objectifs - étape 20
// - n'est pas en place ; remplaçables par utilisateur ensuite)
// ============================================================================

export const DEFAULT_DAILY_GOALS = {
  appels: 20,
  emails: 15,
  rdv: 3,
  propositions: 1,
} as const;

// Compteurs hebdomadaires (5 jours ouvrés × objectifs quotidiens)
export const DEFAULT_WEEKLY_GOALS = {
  appels: 100,
  emails: 75,
  rdv: 15,
  signatures: 2,
} as const;

// ============================================================================
// CATALOGUE — PRIX TARIF STANDARD (à seeder en BDD à l'étape 2)
// ============================================================================

export const CATALOGUE_PRIX = {
  SITE_SIMPLE_ONESHOT: 400,
  SITE_SIMPLE_MENSUEL: 39,
  SITE_HAUT_ONESHOT: 1000,
  SITE_HAUT_MENSUEL: 59,
  RS_BASIQUE_MENSUEL: 249,
  SEO_BASIQUE_MENSUEL: 59,
  ADS_SETUP_ONESHOT: 349,
  ADS_PART_ACLR_MENSUEL: 45, // 30 % de CHF 150 facturé client
  CMO_BASIQUE_MENSUEL: 399,
  METRICOOL_LICENCE_ANNUEL: 249,
} as const;
