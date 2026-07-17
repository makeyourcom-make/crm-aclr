/**
 * Vue par défaut de l'agenda (client-safe — pas d'import serveur ici).
 *
 * Arthur ouvre l'agenda pour piloter l'équipe, pas pour relire son propre
 * planning : le défaut est donc « Toute l'équipe » (décision du 17.07.2026),
 * comme le Pipeline et les Stats.
 *
 * Cette constante est LA référence pour l'absence de `?view=` dans l'URL :
 * le paramètre est omis quand la vue vaut ce défaut, et présent sinon. Toute
 * la navigation (switcher, barre d'outils, liens jour) doit s'y référer —
 * sinon un bouton « efface » le paramètre en croyant revenir à sa vue et
 * retombe en réalité sur une autre.
 *
 * NB : sans effet pour un commercial — sa vue est verrouillée sur ses propres
 * activités côté requête, quel que soit le paramètre.
 */
export const AGENDA_DEFAULT_VIEW = "all";
