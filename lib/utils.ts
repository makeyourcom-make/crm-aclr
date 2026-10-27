import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Ombres du thème MYC Arena (globals.css) : déclarées pour que tailwind-merge
// les traite comme des ombres (sinon cn("shadow-arena", "shadow-lg") garde les deux).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [{ shadow: ["arena", "arena-lg", "cta"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
