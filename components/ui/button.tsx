import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Boutons MYC Arena : rayon 12 px, libellés 700, tailles un peu plus
 * confortables (36 px par défaut, 44 px en `lg` pour les actions principales
 * au doigt, 52 px en `xl` pour le CTA héros).
 *
 * Variantes : default (navy) · hero (dégradé coral, 1 par écran) · outline
 * (blanc, bord #D5DAE6) · secondary · ghost · destructive · link.
 *
 * `hero` : blanc sur dégradé coral = 2.8 à 3.6:1, toléré par le Kit validé
 * UNIQUEMENT avec un libellé 18 px 800 + ombre de texte. La variante impose
 * donc au minimum la taille `lg` (44 px) avec un libellé 18 px, quelle que
 * soit la taille demandée (sauf tailles icône). Anneau de focus coral 600
 * décollé par un liseré blanc : visible sur fond clair comme sur un héros navy.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[12px] border border-transparent bg-clip-padding text-sm font-bold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(14,25,54,0.14)] hover:bg-navy-600",
        hero:
          "bg-gradient-coral font-extrabold text-white shadow-cta text-shadow-[0_1px_1px_rgba(120,20,26,0.35)] hover:brightness-[1.04] hover:shadow-[0_10px_26px_rgba(233,82,86,0.42)] focus-visible:border-coral-600 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        outline:
          "border-border-strong bg-card text-foreground hover:bg-navy-50 hover:text-foreground aria-expanded:bg-navy-50 aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-navy-100 aria-expanded:bg-navy-100 aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-navy-50 hover:text-foreground aria-expanded:bg-navy-50 aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-info-700 underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-[10px] px-2.5 text-xs in-data-[slot=button-group]:rounded-[12px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[10px] px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-[12px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-[18px] text-[15px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-[18px]",
        xl: "h-[52px] gap-2.5 px-5 text-lg has-data-[icon=inline-end]:pr-[18px] has-data-[icon=inline-start]:pl-[18px] [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9",
        "icon-xs":
          "size-7 rounded-[10px] in-data-[slot=button-group]:rounded-[12px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[10px] in-data-[slot=button-group]:rounded-[12px]",
        "icon-lg": "size-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    compoundVariants: [
      {
        // CTA héros : libellé 18 px 800 obligatoire (contraste, cf. Kit).
        variant: "hero",
        size: ["default", "xs", "sm", "lg"],
        class:
          "h-11 gap-2 rounded-[12px] px-[18px] text-lg [&_svg:not([class*='size-'])]:size-5",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
