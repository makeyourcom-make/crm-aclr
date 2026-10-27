"use client";

/**
 * Script d'appel repliable (4 temps) + objections prêtes à dégainer.
 * Contenu repris de la maquette Phoning validée ; l'accroche est personnalisée
 * avec le vrai contact et le prénom de la commerciale.
 */
import { BookOpen, ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

const OBJECTIONS: { label: string; reponse: string; rebond: string }[] = [
  {
    label: "J'ai déjà quelqu'un",
    reponse:
      "Très bien, ça veut dire que vous croyez au digital. Je vous propose 20 minutes pour comparer vos résultats actuels, sans engagement.",
    rebond: "propose un audit gratuit de sa fiche Google.",
  },
  {
    label: "Pas le temps",
    reponse:
      "Justement, je vous prends 20 minutes, chez vous ou en visio, au moment qui vous arrange. Plutôt jeudi matin ou vendredi après-midi ?",
    rebond: "donne toujours deux créneaux au choix.",
  },
  {
    label: "C'est trop cher",
    reponse:
      "Google Ads démarre à 250 CHF de mise en place puis 150 CHF par mois. Un seul nouveau client par mois suffit souvent à le rembourser.",
    rebond: "cite un client de la région sur la même formule.",
  },
  {
    label: "Envoyez-moi un mail",
    reponse:
      "Avec plaisir. Pour vous envoyer quelque chose d'utile : aujourd'hui, d'où viennent vos nouveaux clients ?",
    rebond: "fais-le parler, puis cale 15 minutes pour présenter le mail.",
  },
  {
    label: "Je dois en parler à mon associé",
    reponse:
      "Bien sûr. Le plus simple, c'est un RDV à trois en visio, 20 minutes. Quel jour vous arrange tous les deux ?",
    rebond: "planifie le RDV visio, pas un rappel.",
  },
];

export function CallScript({
  contact,
  myFirstName,
}: {
  contact: string;
  myFirstName: string;
}) {
  const [open, setOpen] = useState(false);
  const [obj, setObj] = useState(0);
  const id = useId();
  const objection = OBJECTIONS[obj] ?? OBJECTIONS[0];

  const steps = [
    {
      titre: "Accroche",
      texte: `Bonjour${contact ? ` ${contact}` : ""}, ${myFirstName || "ici"} de MakeYourCom, l'agence marketing du Chablais. Je vous prends 30 secondes, promis.`,
    },
    {
      titre: "Découverte",
      texte:
        "Aujourd'hui, comment vos nouveaux clients vous trouvent-ils ? Qu'est-ce qui marche, qu'est-ce qui coince ?",
    },
    {
      titre: "Proposition",
      texte:
        "Selon ce qui coince : site internet et SEO pour sortir en tête dans sa ville, réseaux sociaux gérés pour lui, Google Ads ou Meta Ads pour des clients dès la semaine prochaine.",
    },
    {
      titre: "Closing RDV",
      texte:
        "Le plus simple, c'est qu'on se voie 20 minutes. Plutôt jeudi matin ou vendredi après-midi ?",
    },
  ];

  return (
    <section
      aria-label="Script d'appel"
      className="overflow-hidden rounded-[20px] border border-border bg-card shadow-arena"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-contenu`}
        className="flex w-full items-center gap-3 px-5 py-4 text-left text-foreground"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-lvl-50 text-lvl-700"
        >
          <BookOpen className="size-[18px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-extrabold">Script d&apos;appel</span>
          <span className="text-[13px] font-medium text-muted-foreground">
            4 temps, 5 objections prêtes à dégainer
          </span>
        </span>
        <span className="hidden text-[13px] font-bold text-lvl-700 sm:inline">
          {open ? "Replier" : "Déplier"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-[18px] shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div id={`${id}-contenu`} className="flex flex-col gap-4 px-5 pb-5">
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-3">
            {steps.map((s, i) => (
              <li key={s.titre} className="flex flex-col gap-1.5 rounded-[14px] bg-ground p-3.5">
                <span className="inline-flex items-center gap-2 text-[13px] font-extrabold">
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full bg-navy-700 text-xs text-white"
                  >
                    {i + 1}
                  </span>
                  {s.titre}
                </span>
                <span className="text-[13px] leading-relaxed text-foreground">{s.texte}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              Objection entendue ?
            </span>
            <div role="group" aria-label="Objections" className="flex flex-wrap gap-2">
              {OBJECTIONS.map((o, i) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={i === obj}
                  onClick={() => setObj(i)}
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-[13px] font-bold transition-colors",
                    i === obj
                      ? "border-lvl-700 bg-lvl-700 text-white"
                      : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 rounded-[14px] bg-lvl-50 px-4 py-3.5" aria-live="polite">
              <span className="text-[13px] font-extrabold text-lvl-700">Ta réponse</span>
              <span className="text-sm leading-relaxed font-medium text-foreground">
                « {objection.reponse} »
              </span>
              <span className="text-[13px] leading-snug font-semibold text-lvl-700">
                Rebond : {objection.rebond}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
