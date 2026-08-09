/**
 * Document de suivi partagé de la Gestion des projets.
 *
 * C'est un Google Doc que Sophie et Arthur remplissent à deux (ajout de lignes,
 * suivi). On l'intègre en sous-onglet : aperçu en lecture seule + bouton pour
 * l'ouvrir dans Google Docs et l'éditer (Google interdit l'édition dans une
 * iframe tierce — sa politique frame-ancestors bloque l'éditeur).
 *
 * Pour changer de document : remplace `DOSSIERS_DOC_ID` par l'ID du nouveau
 * Doc (la longue chaîne entre /d/ et /edit dans son URL).
 */
export const DOSSIERS_DOC_ID = "1B0ccTI_JsdpIi1s_xbkmMHtwzkxXwKOCgqx_wPFFJsQ";

/** Aperçu intégrable (lecture seule) — se charge dans une iframe. */
export const DOSSIERS_DOC_PREVIEW_URL = `https://docs.google.com/document/d/${DOSSIERS_DOC_ID}/preview`;

/** Édition (ouverte dans un nouvel onglet Google Docs). */
export const DOSSIERS_DOC_EDIT_URL = `https://docs.google.com/document/d/${DOSSIERS_DOC_ID}/edit`;
