/**
 * Styles de champs MYC Arena (Kit §Champs) : 44 px, rayon 12, bord #D5DAE6,
 * focus = bord navy + halo navy 100, erreur = bord alerte.
 *
 * Classes à passer à `<Input className={FIELD_CLASS} />` (tailwind-merge
 * remplace les classes d'origine) ou aux `<select>` / `<textarea>` natifs.
 * 16 px sur téléphone (pas de zoom iOS au focus), 14 px dès 768 px.
 */
const BASE =
  "w-full min-w-0 rounded-[12px] border border-border-strong bg-card text-base font-medium text-foreground shadow-none outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-navy-700 focus-visible:ring-4 focus-visible:ring-navy-100 disabled:cursor-not-allowed disabled:bg-navy-50 disabled:opacity-70 aria-invalid:border-alert-500 aria-invalid:ring-alert-50 md:text-sm";

/** Champ texte / nombre / date, 44 px. */
export const FIELD_CLASS = `${BASE} h-11 px-3`;

/** Variante compacte (filtres de tableau, popovers), 36 px. */
export const FIELD_SM_CLASS = `${BASE} h-9 px-2.5 md:text-[13px]`;

/** `<select>` natif, 44 px. */
export const SELECT_CLASS = `${BASE} h-11 cursor-pointer px-3 pr-8`;

/** `<select>` natif compact, 36 px. */
export const SELECT_SM_CLASS = `${BASE} h-9 cursor-pointer px-2.5 pr-7 md:text-[13px]`;

/** `<textarea>` natif. */
export const TEXTAREA_CLASS = `${BASE} min-h-[88px] px-3 py-2.5 leading-relaxed`;

/** Libellé au-dessus d'un champ (12 px 700). */
export const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-foreground";

/** Aide sous un champ (12 px, muted). */
export const HINT_CLASS = "mt-1.5 text-xs leading-relaxed text-muted-foreground";

/** Case à cocher native (accent navy, cible confortable). */
export const CHECKBOX_CLASS =
  "size-4 shrink-0 cursor-pointer rounded accent-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700";
