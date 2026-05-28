-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "ProspectStatut" AS ENUM ('NOUVEAU', 'CONTACTE', 'QUALIFIE', 'RDV_PRIS', 'PROPOSITION_ENVOYEE', 'SIGNE', 'PERDU', 'NE_PAS_RAPPELER');

-- CreateEnum
CREATE TYPE "ProspectSecteur" AS ENUM ('RESTO_HOTEL', 'E_COMMERCE', 'PME_B2B', 'ARTISAN', 'CABINET_LIBERAL', 'TOURISME', 'IMMOBILIER', 'AUTRE');

-- CreateEnum
CREATE TYPE "ProspectSource" AS ENUM ('FICHIER_IMPORT', 'LINKEDIN', 'REFERRAL', 'WEB', 'AUTRE');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('APPEL_SORTANT', 'APPEL_ENTRANT', 'EMAIL_ENVOYE', 'EMAIL_RECU', 'RDV_PHYSIQUE', 'RDV_VISIO', 'RDV_TELEPHONIQUE', 'SMS', 'LINKEDIN', 'NOTE');

-- CreateEnum
CREATE TYPE "ActivityStatut" AS ENUM ('PLANIFIE', 'EN_COURS', 'FAIT', 'MANQUE', 'REPLANIFIE', 'ANNULE');

-- CreateEnum
CREATE TYPE "ActivityResultat" AS ENUM ('RDV_PRIS', 'REFUS_POLI', 'REFUS_FERME', 'COMBOX', 'NE_DECROCHE_PAS', 'INVALIDE', 'DEJA_CLIENT', 'A_RAPPELER', 'MAUVAISE_PERSONNE', 'INTERESSE_PAS_PRET', 'AUTRE');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('DECOUVERTE', 'PROPOSITION', 'NEGOCIATION', 'SIGNE', 'PERDU');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('ONE_SHOT', 'RECURRENT_MENSUEL', 'RECURRENT_ANNUEL', 'PACK');

-- CreateEnum
CREATE TYPE "ProductCategorie" AS ENUM ('SITE', 'RS', 'SEO', 'ADS', 'CMO', 'METRICOOL', 'PACK');

-- CreateEnum
CREATE TYPE "ContractStatut" AS ENUM ('ACTIF', 'SUSPENDU', 'RESILIE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "ModalitePaiement" AS ENUM ('CINQUANTE_CINQUANTE', 'CENT_AU_SIGNING', 'MENSUEL');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ACOMPTE', 'SOLDE', 'MENSUALITE');

-- CreateEnum
CREATE TYPE "PaymentStatut" AS ENUM ('EN_ATTENTE', 'ENCAISSE', 'EN_RETARD');

-- CreateEnum
CREATE TYPE "CommissionStatut" AS ENUM ('DUE', 'PARTIELLEMENT_VERSEE', 'INTEGRALEMENT_VERSEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "CommissionPaymentTypePart" AS ENUM ('SIGNATURE', 'ETALEMENT', 'RENOUVELLEMENT');

-- CreateEnum
CREATE TYPE "CommissionPaymentStatut" AS ENUM ('PREVU', 'PAYE', 'ANNULE');

-- CreateEnum
CREATE TYPE "RenewalStatut" AS ENUM ('A_VENIR', 'RENOUVELE', 'NON_RENOUVELE');

-- CreateEnum
CREATE TYPE "InvoiceStatut" AS ENUM ('BROUILLON', 'ENVOYEE', 'PAYEE');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('SORTANT', 'ENTRANT');

-- CreateEnum
CREATE TYPE "EmailStatut" AS ENUM ('BROUILLON', 'ENVOYE', 'LIVRE', 'OUVERT', 'CLIQUE', 'REPONDU', 'REBOND', 'ERREUR');

-- CreateEnum
CREATE TYPE "ClientInvoiceType" AS ENUM ('ACOMPTE', 'SOLDE', 'MENSUALITE', 'ANNUELLE', 'PONCTUELLE');

-- CreateEnum
CREATE TYPE "ClientInvoiceStatut" AS ENUM ('BROUILLON', 'ENVOYEE', 'PAYEE', 'EN_RETARD', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ModeReglement" AS ENUM ('VIREMENT', 'TWINT', 'CARTE', 'ESPECES');

-- CreateEnum
CREATE TYPE "ContractOptionType" AS ENUM ('ONE_SHOT', 'RECURRENT_MENSUEL', 'RECURRENT_ANNUEL');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('SIGNATURE_ELECTRONIQUE', 'SIGNATURE_MANUELLE_PDF');

-- CreateEnum
CREATE TYPE "SignatureStatut" AS ENUM ('BROUILLON', 'ENVOYEE', 'SIGNEE_CLIENT', 'SIGNEE_ACLR', 'COMPLETEE', 'REFUSEE', 'EXPIREE');

-- CreateEnum
CREATE TYPE "ObjectivePeriode" AS ENUM ('HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('COLD_1', 'COLD_2_RELANCE', 'COLD_3_RELANCE', 'POST_RDV', 'POST_PROPOSITION', 'RELANCE_PROPOSITION', 'RELANCE_FACTURE', 'RENOUVELLEMENT', 'AUTRE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'COMMERCIAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tauxCommissionSignature" DECIMAL(5,4) NOT NULL DEFAULT 0.25,
    "tauxCommissionRenouvellement" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "garantieMensuelle" DECIMAL(12,2) NOT NULL DEFAULT 2500.00,
    "forfaitFrais" DECIMAL(12,2) NOT NULL DEFAULT 250.00,
    "signatureEmailHtml" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "raisonSociale" TEXT NOT NULL,
    "contactNom" TEXT,
    "contactPrenom" TEXT,
    "contactFonction" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "telephoneMobile" TEXT,
    "adresse" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "canton" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'Suisse',
    "siteWeb" TEXT,
    "linkedIn" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "secteur" "ProspectSecteur",
    "effectif" INTEGER,
    "noga" TEXT,
    "source" "ProspectSource",
    "statut" "ProspectStatut" NOT NULL DEFAULT 'NOUVEAU',
    "scoreInteret" INTEGER NOT NULL DEFAULT 3,
    "assigneAId" TEXT,
    "notesGenerales" TEXT,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prospectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "duree" INTEGER,
    "duree2" INTEGER,
    "sujet" TEXT NOT NULL,
    "contenu" TEXT,
    "statut" "ActivityStatut" NOT NULL DEFAULT 'PLANIFIE',
    "resultat" "ActivityResultat",
    "notesResultat" TEXT,
    "rappelLeDeId" TEXT,
    "prochaineActivityId" TEXT,
    "emailId" TEXT,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prospectId" TEXT NOT NULL,
    "assigneAId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "montantPrevu" DECIMAL(12,2) NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'DECOUVERTE',
    "probabilite" INTEGER NOT NULL DEFAULT 20,
    "closeAttenduLe" TIMESTAMP(3),
    "closeReelLe" TIMESTAMP(3),
    "raisonPerte" TEXT,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL,
    "categorie" "ProductCategorie" NOT NULL,
    "prixOneShot" DECIMAL(12,2),
    "prixMensuel" DECIMAL(12,2),
    "prixAnnuel" DECIMAL(12,2),
    "composantsIds" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prospectId" TEXT NOT NULL,
    "dealId" TEXT,
    "assigneAId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateSignature" TIMESTAMP(3) NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dureeMois" INTEGER NOT NULL DEFAULT 12,
    "statut" "ContractStatut" NOT NULL DEFAULT 'ACTIF',
    "modalitePaiement" "ModalitePaiement" NOT NULL,
    "montantOneShot" DECIMAL(12,2) NOT NULL,
    "montantMensuel" DECIMAL(12,2) NOT NULL,
    "valeurAn1" DECIMAL(12,2) NOT NULL,
    "dateResiliation" TIMESTAMP(3),
    "raisonResiliation" TEXT,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "type" "PaymentType" NOT NULL,
    "statut" "PaymentStatut" NOT NULL DEFAULT 'EN_ATTENTE',
    "referenceFactureClient" TEXT,
    "clientInvoiceId" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "montantTotal" DECIMAL(12,2) NOT NULL,
    "montantPart1" DECIMAL(12,2) NOT NULL,
    "montantPart2" DECIMAL(12,2) NOT NULL,
    "statut" "CommissionStatut" NOT NULL DEFAULT 'DUE',

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "commissionId" TEXT NOT NULL,
    "numeroMois" INTEGER,
    "typePart" "CommissionPaymentTypePart" NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "dateVersementPrevue" TIMESTAMP(3) NOT NULL,
    "dateVersement" TIMESTAMP(3),
    "statut" "CommissionPaymentStatut" NOT NULL DEFAULT 'PREVU',
    "invoiceId" TEXT,

    CONSTRAINT "commission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT NOT NULL,
    "dateRenouvellement" TIMESTAMP(3) NOT NULL,
    "statut" "RenewalStatut" NOT NULL DEFAULT 'A_VENIR',
    "commissionAn2Mensuelle" DECIMAL(12,2) NOT NULL,
    "raisonNonRenouvellement" TEXT,

    CONSTRAINT "renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "mois" TIMESTAMP(3) NOT NULL,
    "montantCommissions" DECIMAL(12,2) NOT NULL,
    "montantGarantieAbsorbee" DECIMAL(12,2) NOT NULL,
    "montantFrais" DECIMAL(12,2) NOT NULL,
    "montantTotal" DECIMAL(12,2) NOT NULL,
    "statut" "InvoiceStatut" NOT NULL DEFAULT 'BROUILLON',
    "referenceFacture" TEXT NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "EmailTemplateType" NOT NULL,
    "objet" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prospectId" TEXT,
    "contractId" TEXT,
    "userId" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "inReplyTo" TEXT,
    "expediteurEmail" TEXT NOT NULL,
    "expediteurNom" TEXT,
    "destinataireEmail" TEXT NOT NULL,
    "cc" TEXT,
    "bcc" TEXT,
    "objet" TEXT NOT NULL,
    "contenuHtml" TEXT NOT NULL,
    "contenuTexte" TEXT NOT NULL,
    "statut" "EmailStatut" NOT NULL DEFAULT 'BROUILLON',
    "envoyeLe" TIMESTAMP(3),
    "livreLe" TIMESTAMP(3),
    "ouvertLe" TIMESTAMP(3),
    "cliqueLe" TIMESTAMP(3),
    "templateUtiliseId" TEXT,
    "labels" TEXT[],

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invoices" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateEmission" TIMESTAMP(3) NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "type" "ClientInvoiceType" NOT NULL,
    "periodeMoisDebut" TIMESTAMP(3),
    "periodeMoisFin" TIMESTAMP(3),
    "sousTotal" DECIMAL(12,2) NOT NULL,
    "totalTVA" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "statut" "ClientInvoiceStatut" NOT NULL DEFAULT 'BROUILLON',
    "datePaiement" TIMESTAMP(3),
    "referenceVirement" TEXT,
    "modeReglement" "ModeReglement",
    "notesClient" TEXT,

    CONSTRAINT "client_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invoice_lines" (
    "id" TEXT NOT NULL,
    "clientInvoiceId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "prixUnitaire" DECIMAL(12,2) NOT NULL,
    "montantHT" DECIMAL(12,2) NOT NULL,
    "tauxTVA" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,

    CONSTRAINT "client_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_options" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "type" "ContractOptionType" NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),

    CONSTRAINT "contract_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "SignatureType" NOT NULL DEFAULT 'SIGNATURE_ELECTRONIQUE',
    "statut" "SignatureStatut" NOT NULL DEFAULT 'BROUILLON',
    "lienSignature" TEXT NOT NULL,
    "signeParClient" BOOLEAN NOT NULL DEFAULT false,
    "dateSignatureClient" TIMESTAMP(3),
    "signeParAclr" BOOLEAN NOT NULL DEFAULT false,
    "dateSignatureAclr" TIMESTAMP(3),
    "ipClient" TEXT,
    "documentPdfUrl" TEXT NOT NULL,
    "documentSigneUrl" TEXT,
    "expireA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "nbAppelsSortants" INTEGER NOT NULL DEFAULT 0,
    "nbAppelsEntrants" INTEGER NOT NULL DEFAULT 0,
    "nbAppelsTotal" INTEGER NOT NULL DEFAULT 0,
    "nbEmailsEnvoyes" INTEGER NOT NULL DEFAULT 0,
    "nbEmailsRecus" INTEGER NOT NULL DEFAULT 0,
    "nbRdvPlanifies" INTEGER NOT NULL DEFAULT 0,
    "nbRdvHonores" INTEGER NOT NULL DEFAULT 0,
    "nbRdvManques" INTEGER NOT NULL DEFAULT 0,
    "nbPropositionsEnvoyees" INTEGER NOT NULL DEFAULT 0,
    "nbContratsSignes" INTEGER NOT NULL DEFAULT 0,
    "montantContratsSignes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nbProspectsNouveaux" INTEGER NOT NULL DEFAULT 0,
    "nbProspectsContactes" INTEGER NOT NULL DEFAULT 0,
    "montantRenouvellementsEncaisses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tauxConversionAppelRdv" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "tauxConversionRdvSignature" DECIMAL(5,4) NOT NULL DEFAULT 0,

    CONSTRAINT "stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "periode" "ObjectivePeriode" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "nbAppelsObjectif" INTEGER,
    "nbEmailsObjectif" INTEGER,
    "nbRdvObjectif" INTEGER,
    "nbPropositionsObjectif" INTEGER,
    "nbSignaturesObjectif" INTEGER,
    "caObjectif" DECIMAL(12,2),
    "commissionObjectif" DECIMAL(12,2),
    "notes" TEXT,
    "isActif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "raisonSociale" TEXT NOT NULL DEFAULT 'ACLR Sàrl',
    "marque" TEXT NOT NULL DEFAULT 'Make Your Com',
    "adresse" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'Suisse',
    "numeroIDE" TEXT,
    "numeroTVA" TEXT,
    "iban" TEXT,
    "bicSwift" TEXT,
    "nomBanque" TEXT,
    "emailContact" TEXT,
    "telephone" TEXT,
    "siteWeb" TEXT,
    "logoUrl" TEXT,
    "signatureAdminUrl" TEXT,
    "tauxCommissionSignatureDefault" DECIMAL(5,4) NOT NULL DEFAULT 0.25,
    "tauxCommissionRenouvellementDefault" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "garantieMensuelleDefault" DECIMAL(12,2) NOT NULL DEFAULT 2500.00,
    "forfaitFraisDefault" DECIMAL(12,2) NOT NULL DEFAULT 250.00,
    "tvaActive" BOOLEAN NOT NULL DEFAULT false,
    "tauxTVA" DECIMAL(5,4) NOT NULL DEFAULT 0.081,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "scope" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("scope","year")
);

-- CreateTable
CREATE TABLE "_DealProducts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DealProducts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ContractProducts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContractProducts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "prospects_statut_idx" ON "prospects"("statut");

-- CreateIndex
CREATE INDEX "prospects_assigneAId_idx" ON "prospects"("assigneAId");

-- CreateIndex
CREATE INDEX "prospects_secteur_idx" ON "prospects"("secteur");

-- CreateIndex
CREATE INDEX "prospects_canton_idx" ON "prospects"("canton");

-- CreateIndex
CREATE INDEX "prospects_raisonSociale_idx" ON "prospects"("raisonSociale");

-- CreateIndex
CREATE UNIQUE INDEX "activities_prochaineActivityId_key" ON "activities"("prochaineActivityId");

-- CreateIndex
CREATE INDEX "activities_prospectId_date_idx" ON "activities"("prospectId", "date");

-- CreateIndex
CREATE INDEX "activities_userId_date_idx" ON "activities"("userId", "date");

-- CreateIndex
CREATE INDEX "activities_statut_date_idx" ON "activities"("statut", "date");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "activities"("type");

-- CreateIndex
CREATE INDEX "deals_stage_idx" ON "deals"("stage");

-- CreateIndex
CREATE INDEX "deals_assigneAId_stage_idx" ON "deals"("assigneAId", "stage");

-- CreateIndex
CREATE INDEX "deals_prospectId_idx" ON "deals"("prospectId");

-- CreateIndex
CREATE INDEX "products_categorie_type_idx" ON "products"("categorie", "type");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_numero_key" ON "contracts"("numero");

-- CreateIndex
CREATE INDEX "contracts_statut_idx" ON "contracts"("statut");

-- CreateIndex
CREATE INDEX "contracts_dateSignature_idx" ON "contracts"("dateSignature");

-- CreateIndex
CREATE INDEX "contracts_assigneAId_statut_idx" ON "contracts"("assigneAId", "statut");

-- CreateIndex
CREATE INDEX "payments_contractId_date_idx" ON "payments"("contractId", "date");

-- CreateIndex
CREATE INDEX "payments_statut_idx" ON "payments"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_contractId_key" ON "commissions"("contractId");

-- CreateIndex
CREATE INDEX "commissions_userId_statut_idx" ON "commissions"("userId", "statut");

-- CreateIndex
CREATE INDEX "commission_payments_commissionId_idx" ON "commission_payments"("commissionId");

-- CreateIndex
CREATE INDEX "commission_payments_statut_dateVersementPrevue_idx" ON "commission_payments"("statut", "dateVersementPrevue");

-- CreateIndex
CREATE INDEX "commission_payments_invoiceId_idx" ON "commission_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "renewals_contractId_idx" ON "renewals"("contractId");

-- CreateIndex
CREATE INDEX "renewals_dateRenouvellement_statut_idx" ON "renewals"("dateRenouvellement", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_referenceFacture_key" ON "invoices"("referenceFacture");

-- CreateIndex
CREATE INDEX "invoices_statut_idx" ON "invoices"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_userId_mois_key" ON "invoices"("userId", "mois");

-- CreateIndex
CREATE INDEX "email_templates_type_idx" ON "email_templates"("type");

-- CreateIndex
CREATE UNIQUE INDEX "emails_messageId_key" ON "emails"("messageId");

-- CreateIndex
CREATE INDEX "emails_prospectId_createdAt_idx" ON "emails"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "emails_threadId_idx" ON "emails"("threadId");

-- CreateIndex
CREATE INDEX "emails_userId_direction_idx" ON "emails"("userId", "direction");

-- CreateIndex
CREATE INDEX "emails_statut_idx" ON "emails"("statut");

-- CreateIndex
CREATE INDEX "email_attachments_emailId_idx" ON "email_attachments"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "client_invoices_numero_key" ON "client_invoices"("numero");

-- CreateIndex
CREATE INDEX "client_invoices_contractId_idx" ON "client_invoices"("contractId");

-- CreateIndex
CREATE INDEX "client_invoices_statut_dateEcheance_idx" ON "client_invoices"("statut", "dateEcheance");

-- CreateIndex
CREATE INDEX "client_invoice_lines_clientInvoiceId_ordre_idx" ON "client_invoice_lines"("clientInvoiceId", "ordre");

-- CreateIndex
CREATE INDEX "contract_options_contractId_actif_idx" ON "contract_options"("contractId", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "signatures_lienSignature_key" ON "signatures"("lienSignature");

-- CreateIndex
CREATE INDEX "signatures_statut_idx" ON "signatures"("statut");

-- CreateIndex
CREATE INDEX "signatures_contractId_idx" ON "signatures"("contractId");

-- CreateIndex
CREATE INDEX "stats_date_idx" ON "stats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "stats_userId_date_key" ON "stats"("userId", "date");

-- CreateIndex
CREATE INDEX "objectives_userId_periode_dateDebut_idx" ON "objectives"("userId", "periode", "dateDebut");

-- CreateIndex
CREATE INDEX "_DealProducts_B_index" ON "_DealProducts"("B");

-- CreateIndex
CREATE INDEX "_ContractProducts_B_index" ON "_ContractProducts"("B");

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_assigneAId_fkey" FOREIGN KEY ("assigneAId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_rappelLeDeId_fkey" FOREIGN KEY ("rappelLeDeId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_prochaineActivityId_fkey" FOREIGN KEY ("prochaineActivityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_assigneAId_fkey" FOREIGN KEY ("assigneAId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_assigneAId_fkey" FOREIGN KEY ("assigneAId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "client_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewals" ADD CONSTRAINT "renewals_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_templateUtiliseId_fkey" FOREIGN KEY ("templateUtiliseId") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "client_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_options" ADD CONSTRAINT "contract_options_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stats" ADD CONSTRAINT "stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DealProducts" ADD CONSTRAINT "_DealProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DealProducts" ADD CONSTRAINT "_DealProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContractProducts" ADD CONSTRAINT "_ContractProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContractProducts" ADD CONSTRAINT "_ContractProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
