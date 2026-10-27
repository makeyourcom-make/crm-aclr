/**
 * Bandeau affiché en haut de l'app quand un admin « voit en tant que » un autre
 * collaborateur. Composant serveur : lit l'état d'impersonation et rend un
 * bouton « Quitter » (form → server action, sans JS client).
 *
 * MYC Arena : bandeau or (#F5A524) + texte navy (contraste 8:1), bouton navy.
 */
import { stopImpersonating } from "@/app/(app)/rh/impersonation-actions";
import { Icon } from "@/components/icon";
import { getImpersonation } from "@/lib/session";

export async function ImpersonationBanner() {
  const imp = await getImpersonation();
  if (!imp) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-gold-500 px-4 py-2 text-center text-[13px] font-semibold text-navy-700 shadow-arena"
    >
      <Icon name="Eye" className="size-4 shrink-0" aria-hidden="true" />
      <span>
        Vue support · tu consultes le CRM en tant que{" "}
        <b className="font-extrabold">{imp.asUser.name}</b>.
      </span>
      <form action={stopImpersonating}>
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-[10px] bg-navy-700 px-3 text-xs font-bold text-white transition-colors hover:bg-navy-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
        >
          Quitter la vue
        </button>
      </form>
    </div>
  );
}
