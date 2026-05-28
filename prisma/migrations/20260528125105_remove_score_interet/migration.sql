-- Suppression du champ scoreInteret (décision UX : étoiles peu pertinentes pour le workflow).
-- Les données du seed (scores 2-5) sont perdues — sans valeur métier persistante.

ALTER TABLE "prospects" DROP COLUMN "scoreInteret";
