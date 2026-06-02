/**
 * Labels FR pour tous les enums Prisma.
 *
 * Pourquoi pas Prisma `@map` sur les valeurs ?
 *   Parce qu'on a souvent besoin de plusieurs variantes (court, long, badge)
 *   et d'options UI riches (couleur, icône). Centralisé ici.
 *
 * Convention :
 *   - getXLabel(value)   → libellé court à afficher
 *   - X_OPTIONS          → tableau {value, label, ...} pour les <Select>
 *   - getXBadge(value)   → couleur Tailwind + variant pour les badges
 */

import {
  ActivityResultat,
  ActivityStatut,
  ActivityType,
  ClientInvoiceStatut,
  ClientInvoiceType,
  CommissionPaymentStatut,
  CommissionPaymentTypePart,
  CommissionStatut,
  ContractOptionType,
  ContractStatut,
  DealStage,
  EmailDirection,
  EmailStatut,
  EmailTemplateType,
  InvoiceStatut,
  ModalitePaiement,
  ModeReglement,
  ObjectivePeriode,
  PaymentStatut,
  PaymentType,
  ProductCategorie,
  ProductType,
  ProspectSecteur,
  ProspectSource,
  ProspectStatut,
  RenewalStatut,
  Role,
  SignatureStatut,
  SignatureType,
} from "@prisma/client";

// Helper type pour les "options" de Select shadcn
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

// ============================================================================
// ROLE
// ============================================================================

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  COMMERCIAL: "Commerciale",
};
export const getRoleLabel = (v: Role) => ROLE_LABELS[v];

// ============================================================================
// PROSPECT — statut
// ============================================================================

const PROSPECT_STATUT_LABELS: Record<ProspectStatut, string> = {
  NOUVEAU: "Nouveau",
  CONTACTE: "Contacté",
  QUALIFIE: "Qualifié",
  RDV_PRIS: "RDV pris",
  PROPOSITION_ENVOYEE: "Proposition envoyée",
  SIGNE: "Signé",
  PERDU: "Perdu",
  NE_PAS_RAPPELER: "Ne pas rappeler",
};
export const getProspectStatutLabel = (v: ProspectStatut) =>
  PROSPECT_STATUT_LABELS[v];

export const PROSPECT_STATUT_OPTIONS: SelectOption<ProspectStatut>[] = (
  Object.keys(PROSPECT_STATUT_LABELS) as ProspectStatut[]
).map((v) => ({ value: v, label: PROSPECT_STATUT_LABELS[v] }));

/** Couleur Tailwind pour les badges statut prospect. */
export const PROSPECT_STATUT_COLORS: Record<ProspectStatut, string> = {
  NOUVEAU: "bg-slate-100 text-slate-700",
  CONTACTE: "bg-blue-100 text-blue-700",
  QUALIFIE: "bg-cyan-100 text-cyan-700",
  RDV_PRIS: "bg-violet-100 text-violet-700",
  PROPOSITION_ENVOYEE: "bg-amber-100 text-amber-700",
  SIGNE: "bg-emerald-100 text-emerald-700",
  PERDU: "bg-slate-200 text-slate-500",
  NE_PAS_RAPPELER: "bg-red-100 text-red-700",
};

// ============================================================================
// PROSPECT — secteur
// ============================================================================

const PROSPECT_SECTEUR_LABELS: Record<ProspectSecteur, string> = {
  RESTO_HOTEL: "Restauration / Hôtellerie",
  E_COMMERCE: "E-commerce",
  PME_B2B: "PME B2B",
  ARTISAN: "Artisan",
  CABINET_LIBERAL: "Cabinet libéral",
  TOURISME: "Tourisme",
  IMMOBILIER: "Immobilier",
  AUTRE: "Autre",
};
export const getProspectSecteurLabel = (v: ProspectSecteur) =>
  PROSPECT_SECTEUR_LABELS[v];
export const PROSPECT_SECTEUR_OPTIONS: SelectOption<ProspectSecteur>[] = (
  Object.keys(PROSPECT_SECTEUR_LABELS) as ProspectSecteur[]
).map((v) => ({ value: v, label: PROSPECT_SECTEUR_LABELS[v] }));

// ============================================================================
// PROSPECT — source
// ============================================================================

const PROSPECT_SOURCE_LABELS: Record<ProspectSource, string> = {
  FICHIER_IMPORT: "Fichier (import CSV)",
  LINKEDIN: "LinkedIn",
  REFERRAL: "Recommandation",
  WEB: "Site web",
  AUTRE: "Autre",
};
export const getProspectSourceLabel = (v: ProspectSource) =>
  PROSPECT_SOURCE_LABELS[v];
export const PROSPECT_SOURCE_OPTIONS: SelectOption<ProspectSource>[] = (
  Object.keys(PROSPECT_SOURCE_LABELS) as ProspectSource[]
).map((v) => ({ value: v, label: PROSPECT_SOURCE_LABELS[v] }));

// ============================================================================
// ACTIVITY — type
// ============================================================================

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  APPEL_SORTANT: "Appel sortant",
  APPEL_ENTRANT: "Appel entrant",
  EMAIL_ENVOYE: "Email envoyé",
  EMAIL_RECU: "Email reçu",
  RDV_PHYSIQUE: "RDV physique",
  RDV_VISIO: "RDV visio",
  RDV_TELEPHONIQUE: "RDV téléphonique",
  SMS: "SMS",
  LINKEDIN: "LinkedIn",
  NOTE: "Note",
};
export const getActivityTypeLabel = (v: ActivityType) =>
  ACTIVITY_TYPE_LABELS[v];
export const ACTIVITY_TYPE_OPTIONS: SelectOption<ActivityType>[] = (
  Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]
).map((v) => ({ value: v, label: ACTIVITY_TYPE_LABELS[v] }));

/** Icône Lucide pour chaque type d'activité. */
export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  APPEL_SORTANT: "PhoneOutgoing",
  APPEL_ENTRANT: "PhoneIncoming",
  EMAIL_ENVOYE: "Mail",
  EMAIL_RECU: "MailOpen",
  RDV_PHYSIQUE: "MapPin",
  RDV_VISIO: "Video",
  RDV_TELEPHONIQUE: "Phone",
  SMS: "MessageSquare",
  LINKEDIN: "Globe", // lucide-react v1 a retiré les icônes de marque (LinkedIn, etc.)
  NOTE: "StickyNote",
};

// ============================================================================
// ACTIVITY — statut
// ============================================================================

const ACTIVITY_STATUT_LABELS: Record<ActivityStatut, string> = {
  PLANIFIE: "Planifié",
  EN_COURS: "En cours",
  FAIT: "Fait",
  MANQUE: "Manqué",
  REPLANIFIE: "Replanifié",
  ANNULE: "Annulé",
};
export const getActivityStatutLabel = (v: ActivityStatut) =>
  ACTIVITY_STATUT_LABELS[v];

// ============================================================================
// ACTIVITY — résultat (les boutons radio de la modale fin d'appel)
// ============================================================================

const ACTIVITY_RESULTAT_LABELS: Record<ActivityResultat, string> = {
  RDV_PRIS: "RDV pris",
  REFUS_POLI: "Refus poli",
  REFUS_FERME: "Refus ferme",
  COMBOX: "Combox / Répondeur",
  NE_DECROCHE_PAS: "Ne décroche pas",
  INVALIDE: "Numéro invalide",
  DEJA_CLIENT: "Déjà client / concurrent",
  A_RAPPELER: "À rappeler",
  MAUVAISE_PERSONNE: "Mauvaise personne",
  INTERESSE_PAS_PRET: "Intéressé, pas prêt",
  AUTRE: "Autre",
};
export const getActivityResultatLabel = (v: ActivityResultat) =>
  ACTIVITY_RESULTAT_LABELS[v];
export const ACTIVITY_RESULTAT_OPTIONS: SelectOption<ActivityResultat>[] = (
  Object.keys(ACTIVITY_RESULTAT_LABELS) as ActivityResultat[]
).map((v) => ({ value: v, label: ACTIVITY_RESULTAT_LABELS[v] }));

/** Couleur du bouton radio dans la modale fin d'appel (cf. spec). */
export const ACTIVITY_RESULTAT_COLORS: Record<ActivityResultat, string> = {
  RDV_PRIS: "emerald", // vert
  REFUS_POLI: "slate", // gris
  REFUS_FERME: "red", // rouge → marque NE_PAS_RAPPELER
  COMBOX: "amber", // orange
  NE_DECROCHE_PAS: "amber", // orange
  INVALIDE: "red", // rouge → marque téléphone invalide
  DEJA_CLIENT: "slate", // gris
  A_RAPPELER: "blue", // bleu
  INTERESSE_PAS_PRET: "blue", // bleu
  MAUVAISE_PERSONNE: "slate", // gris
  AUTRE: "slate",
};

/** Résultats qui déclenchent la planification d'un rappel auto. */
export const RESULTATS_AVEC_RAPPEL: ActivityResultat[] = [
  "COMBOX",
  "NE_DECROCHE_PAS",
  "A_RAPPELER",
  "INTERESSE_PAS_PRET",
];

// ============================================================================
// DEAL — stage
// ============================================================================

const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  DECOUVERTE: "Découverte",
  PROPOSITION: "Proposition",
  NEGOCIATION: "Négociation",
  SIGNE: "Signé",
  PERDU: "Perdu",
};
export const getDealStageLabel = (v: DealStage) => DEAL_STAGE_LABELS[v];

/** Ordre canonique des stages du pipeline Kanban. */
export const DEAL_STAGE_PIPELINE: DealStage[] = [
  "DECOUVERTE",
  "PROPOSITION",
  "NEGOCIATION",
  "SIGNE",
  "PERDU",
];

/** Probabilités par défaut associées à chaque stage. */
export const DEAL_STAGE_PROBA_DEFAUT: Record<DealStage, number> = {
  DECOUVERTE: 10,
  PROPOSITION: 40,
  NEGOCIATION: 70,
  SIGNE: 100,
  PERDU: 0,
};

// ============================================================================
// PRODUCT
// ============================================================================

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  ONE_SHOT: "One-shot",
  RECURRENT_MENSUEL: "Mensuel",
  RECURRENT_ANNUEL: "Annuel",
  PACK: "Pack",
};
export const getProductTypeLabel = (v: ProductType) => PRODUCT_TYPE_LABELS[v];

const PRODUCT_CATEGORIE_LABELS: Record<ProductCategorie, string> = {
  SITE: "Site web",
  RS: "Réseaux sociaux",
  SEO: "Référencement",
  ADS: "Publicité Google/Meta",
  CMO: "CMO fractionné",
  METRICOOL: "Licence Metricool",
  PACK: "Pack",
};
export const getProductCategorieLabel = (v: ProductCategorie) =>
  PRODUCT_CATEGORIE_LABELS[v];

// ============================================================================
// CONTRACT
// ============================================================================

const CONTRACT_STATUT_LABELS: Record<ContractStatut, string> = {
  ATTENTE_SIGNATURE_CLIENT: "En attente signature client",
  ATTENTE_VALIDATION_ADMIN: "À valider par l'admin",
  ACTIF: "Actif",
  SUSPENDU: "Suspendu",
  RESILIE: "Résilié",
  EXPIRE: "Expiré",
};
export const getContractStatutLabel = (v: ContractStatut) =>
  CONTRACT_STATUT_LABELS[v];

const MODALITE_PAIEMENT_LABELS: Record<ModalitePaiement, string> = {
  CINQUANTE_CINQUANTE: "50 % / 50 %",
  CENT_AU_SIGNING: "100 % à la signature",
  MENSUEL: "Mensuel",
};
export const getModalitePaiementLabel = (v: ModalitePaiement) =>
  MODALITE_PAIEMENT_LABELS[v];

const CONTRACT_OPTION_TYPE_LABELS: Record<ContractOptionType, string> = {
  ONE_SHOT: "One-shot",
  RECURRENT_MENSUEL: "Mensuel",
  RECURRENT_ANNUEL: "Annuel",
};
export const getContractOptionTypeLabel = (v: ContractOptionType) =>
  CONTRACT_OPTION_TYPE_LABELS[v];

// ============================================================================
// PAYMENT
// ============================================================================

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  ACOMPTE: "Acompte",
  SOLDE: "Solde",
  MENSUALITE: "Mensualité",
};
export const getPaymentTypeLabel = (v: PaymentType) => PAYMENT_TYPE_LABELS[v];

const PAYMENT_STATUT_LABELS: Record<PaymentStatut, string> = {
  EN_ATTENTE: "En attente",
  ENCAISSE: "Encaissé",
  EN_RETARD: "En retard",
};
export const getPaymentStatutLabel = (v: PaymentStatut) =>
  PAYMENT_STATUT_LABELS[v];

// ============================================================================
// COMMISSION
// ============================================================================

const COMMISSION_STATUT_LABELS: Record<CommissionStatut, string> = {
  DUE: "Due",
  PARTIELLEMENT_VERSEE: "Partiellement versée",
  INTEGRALEMENT_VERSEE: "Intégralement versée",
  ANNULEE: "Annulée",
};
export const getCommissionStatutLabel = (v: CommissionStatut) =>
  COMMISSION_STATUT_LABELS[v];

const COMMISSION_PAYMENT_TYPEPART_LABELS: Record<
  CommissionPaymentTypePart,
  string
> = {
  SIGNATURE: "Signature",
  ETALEMENT: "Étalement",
  RENOUVELLEMENT: "Renouvellement",
};
export const getCommissionPaymentTypePartLabel = (
  v: CommissionPaymentTypePart,
  numeroMois?: number | null,
) => {
  const base = COMMISSION_PAYMENT_TYPEPART_LABELS[v];
  if (v === "ETALEMENT" && numeroMois) return `${base} M+${numeroMois}`;
  return base;
};

const COMMISSION_PAYMENT_STATUT_LABELS: Record<CommissionPaymentStatut, string> = {
  PREVU: "Prévu",
  PAYE: "Payé",
  ANNULE: "Annulé",
};
export const getCommissionPaymentStatutLabel = (v: CommissionPaymentStatut) =>
  COMMISSION_PAYMENT_STATUT_LABELS[v];

// ============================================================================
// RENEWAL
// ============================================================================

const RENEWAL_STATUT_LABELS: Record<RenewalStatut, string> = {
  A_VENIR: "À venir",
  RENOUVELE: "Renouvelé",
  NON_RENOUVELE: "Non renouvelé",
};
export const getRenewalStatutLabel = (v: RenewalStatut) =>
  RENEWAL_STATUT_LABELS[v];

// ============================================================================
// INVOICE (interne, Sophie)
// ============================================================================

const INVOICE_STATUT_LABELS: Record<InvoiceStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
};
export const getInvoiceStatutLabel = (v: InvoiceStatut) =>
  INVOICE_STATUT_LABELS[v];

// ============================================================================
// CLIENT_INVOICE
// ============================================================================

const CLIENT_INVOICE_TYPE_LABELS: Record<ClientInvoiceType, string> = {
  ACOMPTE: "Acompte",
  SOLDE: "Solde",
  MENSUALITE: "Mensualité",
  ANNUELLE: "Annuelle",
  PONCTUELLE: "Ponctuelle",
};
export const getClientInvoiceTypeLabel = (v: ClientInvoiceType) =>
  CLIENT_INVOICE_TYPE_LABELS[v];

const CLIENT_INVOICE_STATUT_LABELS: Record<ClientInvoiceStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
};
export const getClientInvoiceStatutLabel = (v: ClientInvoiceStatut) =>
  CLIENT_INVOICE_STATUT_LABELS[v];

const MODE_REGLEMENT_LABELS: Record<ModeReglement, string> = {
  VIREMENT: "Virement",
  TWINT: "TWINT",
  CARTE: "Carte",
  ESPECES: "Espèces",
};
export const getModeReglementLabel = (v: ModeReglement) =>
  MODE_REGLEMENT_LABELS[v];

// ============================================================================
// EMAIL
// ============================================================================

const EMAIL_DIRECTION_LABELS: Record<EmailDirection, string> = {
  SORTANT: "Sortant",
  ENTRANT: "Entrant",
};
export const getEmailDirectionLabel = (v: EmailDirection) =>
  EMAIL_DIRECTION_LABELS[v];

const EMAIL_STATUT_LABELS: Record<EmailStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  LIVRE: "Livré",
  OUVERT: "Ouvert",
  CLIQUE: "Cliqué",
  REPONDU: "Répondu",
  REBOND: "Rebond",
  ERREUR: "Erreur",
};
export const getEmailStatutLabel = (v: EmailStatut) => EMAIL_STATUT_LABELS[v];

const EMAIL_TEMPLATE_TYPE_LABELS: Record<EmailTemplateType, string> = {
  COLD_1: "Premier contact à froid",
  COLD_2_RELANCE: "Relance n°1 sans réponse",
  COLD_3_RELANCE: "Relance n°2 sans réponse",
  POST_RDV: "Après RDV",
  POST_PROPOSITION: "Après envoi de proposition",
  RELANCE_PROPOSITION: "Relance de proposition",
  RELANCE_FACTURE: "Relance de facture",
  RENOUVELLEMENT: "Renouvellement de contrat",
  AUTRE: "Autre",
};
export const getEmailTemplateTypeLabel = (v: EmailTemplateType) =>
  EMAIL_TEMPLATE_TYPE_LABELS[v];

// ============================================================================
// SIGNATURE
// ============================================================================

const SIGNATURE_TYPE_LABELS: Record<SignatureType, string> = {
  SIGNATURE_ELECTRONIQUE: "Signature électronique",
  SIGNATURE_MANUELLE_PDF: "Signature manuelle (PDF)",
};
export const getSignatureTypeLabel = (v: SignatureType) =>
  SIGNATURE_TYPE_LABELS[v];

const SIGNATURE_STATUT_LABELS: Record<SignatureStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  SIGNEE_CLIENT: "Signée client",
  SIGNEE_ACLR: "Contresignée ACLR",
  COMPLETEE: "Complétée",
  REFUSEE: "Refusée",
  EXPIREE: "Expirée",
};
export const getSignatureStatutLabel = (v: SignatureStatut) =>
  SIGNATURE_STATUT_LABELS[v];

// ============================================================================
// OBJECTIVE
// ============================================================================

const OBJECTIVE_PERIODE_LABELS: Record<ObjectivePeriode, string> = {
  HEBDOMADAIRE: "Hebdomadaire",
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  ANNUEL: "Annuel",
};
export const getObjectivePeriodeLabel = (v: ObjectivePeriode) =>
  OBJECTIVE_PERIODE_LABELS[v];

// ============================================================================
// Liste des cantons suisses (pour le filtre canton sur Prospect)
// ============================================================================

export const CANTONS_SUISSES: SelectOption[] = [
  { value: "VD", label: "Vaud" },
  { value: "GE", label: "Genève" },
  { value: "VS", label: "Valais" },
  { value: "FR", label: "Fribourg" },
  { value: "NE", label: "Neuchâtel" },
  { value: "JU", label: "Jura" },
  { value: "BE", label: "Berne" },
  { value: "ZH", label: "Zurich" },
  { value: "BL", label: "Bâle-Campagne" },
  { value: "BS", label: "Bâle-Ville" },
  { value: "AG", label: "Argovie" },
  { value: "SO", label: "Soleure" },
  { value: "LU", label: "Lucerne" },
  { value: "ZG", label: "Zoug" },
  { value: "SZ", label: "Schwytz" },
  { value: "UR", label: "Uri" },
  { value: "OW", label: "Obwald" },
  { value: "NW", label: "Nidwald" },
  { value: "GL", label: "Glaris" },
  { value: "AR", label: "Appenzell Rh.-Ext." },
  { value: "AI", label: "Appenzell Rh.-Int." },
  { value: "SG", label: "Saint-Gall" },
  { value: "GR", label: "Grisons" },
  { value: "TG", label: "Thurgovie" },
  { value: "SH", label: "Schaffhouse" },
  { value: "TI", label: "Tessin" },
];
