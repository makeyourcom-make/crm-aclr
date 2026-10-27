"use client";

/**
 * Boîte mail MYC Arena (« Gmail version arena ») : dossiers + liste des fils +
 * lecture, avec la couche de jeu de la rubrique Emails.
 *
 * - Dossiers (à la Gmail) : Boîte de réception / Messages envoyés / Brouillons /
 *   Archivés, puis Spam et Corbeille (dossiers distincts). Pas de « Tous les
 *   messages » : ce serait l'union exacte réception + envoyés (doublon).
 * - Défi « Inbox zéro » : jauge des non lus vers 0 (même périmètre que le badge).
 * - « À traiter en priorité » : fils chauds calculés sur les vrais mails
 *   (réponse attendue, lead à capter, brouillon qui traîne, relance).
 * - Liste : fils regroupés par threadId, dernier mail en haut, entreprise liée.
 * - Lecture : fil chronologique, entreprise CRM liée ou « Lead à capter »,
 *   suivi du dernier envoi, actions du fil (archiver, spam, corbeille).
 * - Répondre / Transférer (Cc / Cci), brouillon de réponse enregistrable.
 * - Spam : « Pas un spam » (→ boîte de réception + règle désactivée) ;
 *   « Spam » en sélection multiple depuis la boîte.
 * - Un envoi rattaché à un client rapporte +3 XP (activité EMAIL_ENVOYE) :
 *   toast XP puis router.refresh() pour mettre à jour la coquille.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  File as FileIcon,
  FileText,
  Forward,
  Image as ImageIcon,
  Inbox,
  MailOpen,
  Paperclip,
  PenLine,
  Plus,
  Reply,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  archiveThread,
  archiveThreadsBulk,
  attachEmailToCollaborateur,
  attachEmailToProspect,
  deleteEmail,
  deleteThreadsBulk,
  emptySpam,
  emptyTrash,
  forwardEmail,
  getMyDefaultSignatureHtml,
  markEmailAsSpam,
  markThreadRead,
  markThreadsAsSpam,
  markThreadsNotSpam,
  purgeEmail,
  refetchEmailBody,
  replyToEmail,
  restoreEmail,
  restoreThreadsBulk,
  saveEmailDraft,
  searchCollaborateursForAttach,
  searchProspectsForAttach,
  sendDraft,
  setEmailArchive,
} from "@/app/(app)/emails/actions";
import { createProspectQuick } from "@/app/(app)/prospects/actions";
import { EmptyState } from "@/components/arena/empty-state";
import { Meter } from "@/components/arena/meter";
import { StatusPill, XpPill } from "@/components/arena/pills";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { xpToast } from "@/components/arena/celebrate";
import {
  AttachmentPicker,
  type PickedAttachment,
} from "@/components/emails/attachment-picker";
import { EmailHtmlFrame } from "@/components/emails/email-html-frame";
import {
  CAPS_CLASS,
  FIELD_CLASS,
  formatWait,
  initialsFrom,
  mailDateTime,
  mailShortDate,
  uiText,
} from "@/components/emails/mail-ui";
import { RecipientInput } from "@/components/emails/recipient-input";
import { RichTextEditor } from "@/components/emails/rich-text-editor";
import { Button } from "@/components/ui/button";
import { htmlToPlainText } from "@/lib/email-html";
import { formatFileSize } from "@/lib/format";
import { XP_RULES } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  LIVRE: "Livré",
  OUVERT: "Ouvert",
  CLIQUE: "Cliqué",
  REPONDU: "Répondu",
  REBOND: "Rebond",
  ERREUR: "Erreur",
};

const STATUT_TONE: Record<string, Tone> = {
  BROUILLON: "navy",
  ENVOYE: "navy",
  LIVRE: "blue",
  OUVERT: "teal",
  CLIQUE: "green",
  REPONDU: "violet",
  REBOND: "red",
  ERREUR: "red",
};

/** Rang des statuts d'envoi (mêmes règles que le webhook Resend). */
const STATUT_RANK: Record<string, number> = {
  BROUILLON: 0,
  ENVOYE: 1,
  LIVRE: 2,
  OUVERT: 3,
  CLIQUE: 4,
  REPONDU: 5,
};

/** Variables remplacées côté serveur quand le mail est lié à un client. */
const MAIL_VARIABLES = [
  "{{prenomContact}}",
  "{{nomContact}}",
  "{{raisonSociale}}",
  "{{ville}}",
  "{{commerciale}}",
];

const DAY_MS = 86_400_000;

export interface InboxAttachment {
  id: string;
  nom: string;
  taille: number;
  mimeType: string;
  url: string;
}

export interface InboxProspect {
  id: string;
  raisonSociale: string;
  ville?: string | null;
  /** Libellé du statut CRM (« RDV pris »…), calculé côté serveur. */
  statutLabel?: string | null;
  statutTone?: Tone | null;
}

export interface InboxEmail {
  id: string;
  direction: "SORTANT" | "ENTRANT";
  threadId: string;
  expediteurEmail: string;
  expediteurNom: string | null;
  destinataireEmail: string;
  cc?: string | null;
  bcc?: string | null;
  objet: string;
  contenuHtml: string;
  contenuTexte: string;
  statut: string;
  envoyeLe: string | null;
  createdAt: string;
  lu: boolean;
  labels: string[];
  resendInboundId: string | null;
  prospect: InboxProspect | null;
  collaborateur: { id: string; name: string } | null;
  user: { name: string } | null;
  attachments: InboxAttachment[];
}

/** Vrai brouillon = enregistré volontairement (pas un mail dry-run). */
const isGenuineDraft = (m: InboxEmail) =>
  m.statut === "BROUILLON" && m.labels.includes("draft");

const mailTs = (m: InboxEmail) => new Date(m.envoyeLe ?? m.createdAt).getTime();

interface ThreadGroup {
  threadId: string;
  msgs: InboxEmail[];
  last: InboxEmail;
  first: InboxEmail;
}

/** Regroupe les emails par thread (1er message en haut, threads triés desc). */
function groupThreads(emails: InboxEmail[]): ThreadGroup[] {
  const map = new Map<string, InboxEmail[]>();
  for (const e of emails) {
    if (!map.has(e.threadId)) map.set(e.threadId, []);
    map.get(e.threadId)!.push(e);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) =>
        new Date(a.envoyeLe ?? a.createdAt).getTime() -
        new Date(b.envoyeLe ?? b.createdAt).getTime(),
    );
  }
  return Array.from(map.entries())
    .map(([threadId, msgs]) => ({
      threadId,
      msgs,
      last: msgs[msgs.length - 1]!,
      first: msgs[0]!,
    }))
    .sort(
      (a, b) =>
        new Date(b.last.envoyeLe ?? b.last.createdAt).getTime() -
        new Date(a.last.envoyeLe ?? a.last.createdAt).getTime(),
    );
}

interface InboxViewProps {
  emails: InboxEmail[];
  /** Emails à la corbeille (soft-deleted) : dossiers « Spam » et « Corbeille ». */
  trashedEmails?: InboxEmail[];
  /** Emails archivés (retirés de la boîte, hors corbeille) : dossier « Archivés ». */
  archivedEmails?: InboxEmail[];
  isAdmin: boolean;
  /** Email courant de l'user (pour identifier "soi-même") */
  currentUserEmail: string;
  /** Instant du rendu serveur (dates relatives sans Date.now() au rendu). */
  nowMs: number;
  /** Non lus de la boîte (compte exact serveur, hors archivés / corbeille). */
  unreadInbox?: number;
  /** Mails reçus lus aujourd'hui (défi Inbox zéro). */
  treatedToday?: number;
  /** Résumé des filtres anti-spam (règles actives, mails bloqués). */
  spamSummary?: { active: number; blocked: number };
}

type FolderType = "inbox" | "sent" | "draft" | "archive" | "spam" | "trash";

const FOLDER_TITLE: Record<FolderType, string> = {
  inbox: "Boîte de réception",
  sent: "Messages envoyés",
  draft: "Brouillons",
  archive: "Archivés",
  spam: "Spam",
  trash: "Corbeille",
};

/** Mail filtré par l'anti-spam (vit dans le dossier Spam, pas la Corbeille). */
const isSpam = (m: InboxEmail) => m.labels.includes("spam");

/** Message de confirmation après « Pas un spam ». */
function notSpamMessage(moved: number, rulesDisabled: string[]): string {
  const base = `${moved} message(s) remis dans la boîte de réception`;
  return rulesDisabled.length > 0
    ? `${base} · filtre désactivé : ${rulesDisabled.join(", ")}`
    : base;
}

/** Fil chaud proposé dans « À traiter en priorité » (données réelles). */
interface RadarItem {
  key: string;
  tone: Tone;
  icon: LucideIcon;
  tag: string;
  title: string;
  detail: string;
  cta: string;
  threadId: string;
  folder: FolderType;
  mode: "reply" | null;
}

/** Ouverture d'un fil demandée par le radar (réponse prête ou non). */
interface OpenIntent {
  threadId: string;
  mode: "reply" | null;
  nonce: number;
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

export function InboxView({
  emails,
  trashedEmails = [],
  archivedEmails = [],
  isAdmin,
  currentUserEmail,
  nowMs,
  unreadInbox,
  treatedToday = 0,
  spamSummary,
}: InboxViewProps) {
  const router = useRouter();
  const [bulkPending, startBulk] = useTransition();
  // Comme Gmail : on ouvre sur la boîte de réception.
  const [folder, setFolder] = useState<FolderType>("inbox");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Sélection multiple (par threadId) pour archivage / suppression en masse.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  // Mails (ids) marqués lus dans cette session (affichage immédiat, avant
  // refresh). Par mail et non par fil : un nouveau mail reçu plus tard dans un
  // fil déjà ouvert doit réapparaître comme non lu (comportement d'origine).
  const [readLocal, setReadLocal] = useState<Set<string>>(new Set());
  const [intent, setIntent] = useState<OpenIntent | null>(null);
  const mailboxRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const readerRef = useRef<HTMLElement>(null);

  // Rafraîchissement automatique de la boîte : recharge les données serveur
  // toutes les 30 s + au retour sur l'onglet, pour faire apparaître les
  // nouveaux mails sans recharger la page. router.refresh() est "soft" : il
  // conserve le thread ouvert, la sélection et un brouillon de réponse en
  // cours d'écriture (l'état des composants client n'est pas réinitialisé).
  useEffect(() => {
    const REFRESH_MS = 30_000;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = setInterval(tick, REFRESH_MS);
    // Recharge aussi dès que l'utilisateur revient sur l'onglet du CRM.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  // Note : depuis la décision "mailbox privée par user", on ne filtre plus par
  // propriétaire : la page ne sert QUE les mails du user connecté côté serveur.

  const inTrash = folder === "trash";
  const inSpam = folder === "spam";
  const inArchive = folder === "archive";

  // Regroupe les emails par thread : boîte active, Archivés, Spam et Corbeille
  // séparés (les mails filtrés portent le label "spam" ; le reste des
  // supprimés = Corbeille).
  const threads = useMemo(() => groupThreads(emails), [emails]);
  const archiveThreads = useMemo(() => groupThreads(archivedEmails), [archivedEmails]);
  const spamThreads = useMemo(
    () => groupThreads(trashedEmails.filter(isSpam)),
    [trashedEmails],
  );
  const trashThreads = useMemo(
    () => groupThreads(trashedEmails.filter((m) => !isSpam(m))),
    [trashedEmails],
  );

  const isMsgUnread = (m: InboxEmail) => !m.lu && !readLocal.has(m.id);
  const isThreadUnread = (t: ThreadGroup) => t.msgs.some(isMsgUnread);

  // Filtre par dossier
  const filteredThreads = useMemo(() => {
    let t = inSpam
      ? spamThreads
      : inTrash
        ? trashThreads
        : inArchive
          ? archiveThreads
          : threads;
    if (folder === "inbox") {
      t = t.filter((th) => th.msgs.some((m) => m.direction === "ENTRANT"));
    } else if (folder === "sent") {
      t = t.filter((th) =>
        th.msgs.some((m) => m.direction === "SORTANT" && !isGenuineDraft(m)),
      );
    } else if (folder === "draft") {
      t = t.filter((th) => th.msgs.some(isGenuineDraft));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      t = t.filter(
        (th) =>
          th.last.objet.toLowerCase().includes(q) ||
          th.last.expediteurEmail.toLowerCase().includes(q) ||
          (th.last.expediteurNom ?? "").toLowerCase().includes(q) ||
          th.last.destinataireEmail.toLowerCase().includes(q) ||
          th.last.prospect?.raisonSociale?.toLowerCase().includes(q) ||
          th.msgs.some((m) => m.contenuTexte.toLowerCase().includes(q)),
      );
    }
    return t;
  }, [threads, archiveThreads, spamThreads, trashThreads, inSpam, inTrash, inArchive, folder, search]);

  const counts = useMemo(
    () => ({
      inbox: threads.filter((t) => t.msgs.some((m) => m.direction === "ENTRANT")).length,
      // Non lus de la boîte de réception (affiché en gras comme Gmail).
      inboxUnread: threads.filter((t) =>
        t.msgs.some((m) => m.direction === "ENTRANT" && !m.lu && !readLocal.has(m.id)),
      ).length,
      sent: threads.filter((t) =>
        t.msgs.some((m) => m.direction === "SORTANT" && !isGenuineDraft(m)),
      ).length,
      draft: threads.filter((t) => t.msgs.some(isGenuineDraft)).length,
      archive: archiveThreads.length,
      spam: spamThreads.length,
      trash: trashThreads.length,
    }),
    [threads, archiveThreads, spamThreads, trashThreads, readLocal],
  );

  // ---- Défi Inbox zéro (non lus → 0) ----
  const locallyRead = emails.filter(
    (m) => m.direction === "ENTRANT" && !m.lu && readLocal.has(m.id),
  ).length;
  const baseUnread =
    unreadInbox ?? emails.filter((m) => m.direction === "ENTRANT" && !m.lu).length;
  const unreadNow = Math.max(0, baseUnread - locallyRead);
  const treatedNow = treatedToday + locallyRead;

  // ---- « À traiter en priorité » : fils chauds (vrais mails) ----
  const radar = useMemo<RadarItem[]>(() => {
    const out: RadarItem[] = [];
    const realOf = (t: ThreadGroup) => t.msgs.filter((m) => !isGenuineDraft(m));
    const lastRealOf = (t: ThreadGroup) => {
      const r = realOf(t);
      return r[r.length - 1] ?? null;
    };

    // 1. Un client attend ta réponse (le plus ancien d'abord, 14 jours max).
    const waiting = threads
      .map((t) => ({ t, l: lastRealOf(t) }))
      .filter(
        ({ l }) =>
          !!l &&
          l.direction === "ENTRANT" &&
          !!l.prospect &&
          nowMs - mailTs(l) < 14 * DAY_MS,
      )
      .sort((a, b) => mailTs(a.l!) - mailTs(b.l!));
    if (waiting[0]) {
      const { t, l } = waiting[0];
      out.push({
        key: "wait",
        tone: "coral",
        icon: Reply,
        tag: `Attend ta réponse depuis ${formatWait(nowMs - mailTs(l!))}`,
        title: l!.prospect!.raisonSociale,
        detail: `${l!.expediteurNom || l!.expediteurEmail} : « ${truncate(l!.objet, 70)} »${
          waiting.length > 1 ? ` · ${waiting.length} fils attendent ta réponse` : ""
        }`,
        cta: "Répondre maintenant",
        threadId: t.threadId,
        folder: "inbox",
        mode: "reply",
      });
    }

    // 2. Lead à capter : mail reçu, aucune entreprise CRM liée.
    const leads = threads
      .filter(
        (t) =>
          t.msgs.some((m) => m.direction === "ENTRANT") &&
          !t.msgs.some((m) => m.prospect),
      )
      .sort((a, b) => mailTs(b.last) - mailTs(a.last));
    if (leads[0]) {
      const t = leads[0];
      const inbound = [...t.msgs].reverse().find((m) => m.direction === "ENTRANT") ?? t.last;
      out.push({
        key: "lead",
        tone: "blue",
        icon: UserPlus,
        tag: leads.length > 1 ? `Lead à capter · ${leads.length} en attente` : "Lead à capter",
        title: inbound.expediteurNom || inbound.expediteurEmail,
        detail: `T'a écrit le ${mailDateTime(inbound.envoyeLe ?? inbound.createdAt)} · pas encore rattaché au CRM.`,
        cta: "Capter le lead",
        threadId: t.threadId,
        folder: "inbox",
        mode: null,
      });
    }

    // 3. Brouillon qui traîne depuis plus de 24 h.
    const drafts = threads
      .flatMap((t) => t.msgs.filter(isGenuineDraft).map((m) => ({ t, m })))
      .filter(({ m }) => nowMs - new Date(m.createdAt).getTime() > DAY_MS)
      .sort((a, b) => new Date(a.m.createdAt).getTime() - new Date(b.m.createdAt).getTime());
    if (drafts[0]) {
      const { t, m } = drafts[0];
      out.push({
        key: "draft",
        tone: "gold",
        icon: PenLine,
        tag: `Brouillon · traîne depuis ${formatWait(nowMs - new Date(m.createdAt).getTime())}`,
        title: m.prospect?.raisonSociale || m.destinataireEmail || "Destinataire à choisir",
        detail: `« ${truncate(m.objet === "(brouillon sans objet)" ? "Sans objet" : m.objet, 70)} » · on l'envoie ?`,
        cta: "Reprendre le brouillon",
        threadId: t.threadId,
        folder: "draft",
        mode: null,
      });
    }

    // 4. Relance : dernier mail envoyé à un client, sans réponse depuis 3 à 21 jours.
    const relances = threads
      .map((t) => ({ t, l: lastRealOf(t) }))
      .filter(({ l }) => {
        if (!l || l.direction !== "SORTANT" || !l.prospect) return false;
        if (l.statut === "REBOND" || l.statut === "ERREUR") return false;
        const age = nowMs - mailTs(l);
        return age >= 3 * DAY_MS && age <= 21 * DAY_MS;
      })
      .sort((a, b) => mailTs(b.l!) - mailTs(a.l!));
    if (relances[0]) {
      const { t, l } = relances[0];
      out.push({
        key: "relance",
        tone: "violet",
        icon: Send,
        tag: `Sans réponse depuis ${formatWait(nowMs - mailTs(l!))}`,
        title: l!.prospect!.raisonSociale,
        detail: `« ${truncate(l!.objet, 70)} » envoyé le ${mailDateTime(l!.envoyeLe ?? l!.createdAt)}. Une relance courte suffit.`,
        cta: "Relancer",
        threadId: t.threadId,
        folder: "sent",
        mode: "reply",
      });
    }
    return out;
  }, [threads, nowMs]);

  const selectedThread = filteredThreads.find((t) => t.threadId === selectedThreadId);

  const scrollTo = (el: HTMLElement | null, onlyMobile: boolean) => {
    if (!el || typeof window === "undefined") return;
    if (onlyMobile && !window.matchMedia("(max-width: 1023px)").matches) return;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  /** Ouvre un fil (sans toucher à l'intention du radar). */
  const openThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    // Marque le thread comme lu si au moins 1 message non lu
    const t =
      threads.find((th) => th.threadId === threadId) ??
      archiveThreads.find((th) => th.threadId === threadId);
    const unreadIds = t ? t.msgs.filter(isMsgUnread).map((m) => m.id) : [];
    if (unreadIds.length > 0) {
      setReadLocal((prev) => {
        const next = new Set(prev);
        unreadIds.forEach((id) => next.add(id));
        return next;
      });
      // Rafraîchit ensuite : badge non lus, défi Inbox zéro, coquille.
      void markThreadRead(threadId).then((r) => {
        if (r.ok && (r.count ?? 0) > 0) router.refresh();
      });
    }
    scrollTo(readerRef.current, true);
  };

  /** Clic dans la liste : oublie l'intention du radar si c'est un autre fil. */
  const handleSelectThread = (threadId: string) => {
    if (intent && intent.threadId !== threadId) setIntent(null);
    openThread(threadId);
  };

  /** Ouvre un fil depuis le radar : bon dossier, recherche vidée, réponse prête. */
  const openFromRadar = (item: Pick<RadarItem, "threadId" | "folder" | "mode">) => {
    setFolder(item.folder);
    setSearch("");
    setCheckedIds(new Set());
    setIntent((prev) => ({
      threadId: item.threadId,
      mode: item.mode,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
    openThread(item.threadId);
    // Sur grand écran, on amène la boîte à l'écran (sur téléphone, openThread
    // fait déjà défiler jusqu'à la lecture).
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      scrollTo(mailboxRef.current, false);
    }
  };

  const changeFolder = (f: FolderType) => {
    setFolder(f);
    setSelectedThreadId(null);
  };

  // ---- Sélection multiple ----
  const toggleChecked = (threadId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  // Ne garde dans la sélection que les threads visibles dans le dossier courant.
  const visibleCheckedIds = useMemo(
    () => filteredThreads.filter((t) => checkedIds.has(t.threadId)),
    [filteredThreads, checkedIds],
  );
  const allVisibleChecked =
    filteredThreads.length > 0 &&
    visibleCheckedIds.length === filteredThreads.length;

  const toggleAllVisible = () => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) {
        filteredThreads.forEach((t) => next.delete(t.threadId));
      } else {
        filteredThreads.forEach((t) => next.add(t.threadId));
      }
      return next;
    });
  };

  const clearSelection = () => setCheckedIds(new Set());

  const handleBulkArchive = () => {
    const ids = visibleCheckedIds.map((t) => t.threadId);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Archiver ${ids.length} conversation(s) ? Elles quittent la boîte de réception (toujours visibles sur les fiches clients et dans Archivés).`,
      )
    )
      return;
    startBulk(async () => {
      const res = await archiveThreadsBulk(ids);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de l'archivage."));
        return;
      }
      toast.success(`${ids.length} conversation(s) archivée(s).`);
      clearSelection();
      if (selectedThreadId && ids.includes(selectedThreadId))
        setSelectedThreadId(null);
      router.refresh();
    });
  };

  /** Archivés → remet les fils sélectionnés dans la boîte (désarchive chaque mail). */
  const handleBulkUnarchive = () => {
    const sel = visibleCheckedIds;
    if (sel.length === 0) return;
    startBulk(async () => {
      for (const t of sel) {
        for (const m of t.msgs) {
          const res = await setEmailArchive(m.id, false);
          if (!res.ok) {
            toast.error(uiText(res.error, "Échec du désarchivage."));
            return;
          }
        }
      }
      toast.success(`${sel.length} conversation(s) remise(s) dans la boîte.`);
      clearSelection();
      if (selectedThreadId && sel.some((t) => t.threadId === selectedThreadId))
        setSelectedThreadId(null);
      router.refresh();
    });
  };

  /** Marque les fils sélectionnés comme lus (défi Inbox zéro). */
  const handleBulkRead = () => {
    const ids = visibleCheckedIds.map((t) => t.threadId);
    if (ids.length === 0) return;
    const msgIds = visibleCheckedIds.flatMap((t) => t.msgs.filter((m) => !m.lu).map((m) => m.id));
    startBulk(async () => {
      for (const id of ids) {
        const res = await markThreadRead(id);
        if (!res.ok) {
          toast.error(uiText(res.error, "Échec."));
          return;
        }
      }
      setReadLocal((prev) => {
        const next = new Set(prev);
        msgIds.forEach((i) => next.add(i));
        return next;
      });
      toast.success(`${ids.length} conversation(s) marquée(s) comme lue(s).`);
      clearSelection();
      router.refresh();
    });
  };

  const handleBulkDelete = () => {
    const ids = visibleCheckedIds.map((t) => t.threadId);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Mettre ${ids.length} conversation(s) à la corbeille ? Tu pourras les restaurer.`,
      )
    )
      return;
    startBulk(async () => {
      const res = await deleteThreadsBulk(ids);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de la suppression."));
        return;
      }
      toast.success(`${ids.length} conversation(s) mise(s) à la corbeille.`);
      clearSelection();
      if (selectedThreadId && ids.includes(selectedThreadId))
        setSelectedThreadId(null);
      router.refresh();
    });
  };

  const handleBulkRestore = () => {
    const ids = visibleCheckedIds.map((t) => t.threadId);
    if (ids.length === 0) return;
    startBulk(async () => {
      const res = await restoreThreadsBulk(ids);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de la restauration."));
        return;
      }
      toast.success(`${ids.length} conversation(s) restaurée(s).`);
      clearSelection();
      if (selectedThreadId && ids.includes(selectedThreadId))
        setSelectedThreadId(null);
      router.refresh();
    });
  };

  const handleEmptyTrash = () => {
    if (
      !confirm(
        "Vider la corbeille ? Tous les emails qui s'y trouvent seront supprimés définitivement (irréversible).",
      )
    )
      return;
    startBulk(async () => {
      const res = await emptyTrash();
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(`Corbeille vidée (${res.count ?? 0} email(s) purgé(s)).`);
      clearSelection();
      setSelectedThreadId(null);
      router.refresh();
    });
  };

  const handleBulkNotSpam = () => {
    const ids = visibleCheckedIds.map((t) => t.threadId);
    if (ids.length === 0) return;
    startBulk(async () => {
      const res = await markThreadsNotSpam(ids);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(notSpamMessage(res.moved ?? 0, res.rulesDisabled ?? []));
      clearSelection();
      if (selectedThreadId && ids.includes(selectedThreadId))
        setSelectedThreadId(null);
      router.refresh();
    });
  };

  const handleBulkSpam = () => {
    const ids = visibleCheckedIds.map((t) => t.threadId);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Signaler ${ids.length} conversation(s) comme spam ?\n\nLes expéditeurs seront bloqués : leurs mails actuels et futurs iront dans le dossier Spam (récupérables via « Pas un spam »).`,
      )
    )
      return;
    startBulk(async () => {
      const res = await markThreadsAsSpam(ids);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(
        `${res.moved ?? 0} message(s) déplacé(s) dans Spam` +
          (res.skipped
            ? ` · ${res.skipped} conversation(s) liée(s) à un client ignorée(s)`
            : ""),
      );
      clearSelection();
      if (selectedThreadId && ids.includes(selectedThreadId))
        setSelectedThreadId(null);
      router.refresh();
    });
  };

  const handleEmptySpam = () => {
    if (
      !confirm(
        "Vider le dossier Spam ? Tous les mails filtrés seront supprimés définitivement (irréversible).",
      )
    )
      return;
    startBulk(async () => {
      const res = await emptySpam();
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(`Spam vidé (${res.count ?? 0} email(s) supprimé(s)).`);
      clearSelection();
      setSelectedThreadId(null);
      router.refresh();
    });
  };

  const folderMeta: Record<FolderType, string> = {
    inbox: `${counts.inboxUnread} non lu${counts.inboxUnread > 1 ? "s" : ""} · ${counts.inbox} fil${counts.inbox > 1 ? "s" : ""}`,
    sent: `${counts.sent} fil${counts.sent > 1 ? "s" : ""}`,
    draft: `${counts.draft} brouillon${counts.draft > 1 ? "s" : ""} à envoyer`,
    archive: `${counts.archive} fil${counts.archive > 1 ? "s" : ""} archivé${counts.archive > 1 ? "s" : ""}`,
    spam: `${counts.spam} fil${counts.spam > 1 ? "s" : ""} filtré${counts.spam > 1 ? "s" : ""}`,
    trash: `${counts.trash} fil${counts.trash > 1 ? "s" : ""}`,
  };

  const intentFor = (threadId: string) =>
    intent && intent.threadId === threadId ? intent : null;

  return (
    <div className="space-y-6">
      {/* ── À traiter en priorité ─────────────────────────────────────── */}
      <section aria-labelledby="radar-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="radar-title"
            className="font-display text-xl font-extrabold tracking-[-0.02em] text-foreground"
          >
            À traiter en priorité
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Les fils chauds passent avant tout le reste. Un clic et c&apos;est prêt.
          </p>
        </div>
        {radar.length > 0 ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {radar.map((r) => (
              <RadarCard key={r.key} item={r} onGo={() => openFromRadar(r)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-border bg-card px-4 py-3 shadow-arena">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-win-50 text-win-700"
            >
              <Check className="size-[18px]" strokeWidth={2.5} />
            </span>
            <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
              Rien d&apos;urgent : aucun client n&apos;attend ta réponse et aucun lead ne traîne.
            </p>
            <Link
              href="/phoning"
              className="text-sm font-bold text-info-700 underline-offset-4 hover:underline"
            >
              Lancer une session de phoning
            </Link>
          </div>
        )}
      </section>

      {/* ── Boîte mail ────────────────────────────────────────────────── */}
      <section
        ref={mailboxRef}
        aria-label="Boîte mail"
        className="grid scroll-mt-4 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-[208px_minmax(0,340px)_minmax(0,1fr)]"
      >
        {/* Colonne dossiers + défi */}
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-2 lg:flex-row lg:items-stretch xl:col-span-1 xl:flex-col">
          <InboxZeroCard
            unread={unreadNow}
            treated={treatedNow}
            className="lg:w-[300px] lg:shrink-0 xl:w-auto"
          />

          <nav
            aria-label="Dossiers"
            className="flex gap-1 overflow-x-auto rounded-[20px] border border-border bg-card p-2 shadow-arena lg:min-w-0 lg:flex-1 lg:flex-wrap lg:content-start lg:overflow-visible xl:flex-none xl:flex-col xl:flex-nowrap"
          >
            <FolderButton
              label="Boîte de réception"
              icon={Inbox}
              count={counts.inboxUnread}
              countLabel="non lus"
              tone={counts.inboxUnread > 0 ? "teal" : undefined}
              emphasize={counts.inboxUnread > 0}
              active={folder === "inbox"}
              onClick={() => changeFolder("inbox")}
            />
            <FolderButton
              label="Envoyés"
              icon={Send}
              count={counts.sent}
              active={folder === "sent"}
              onClick={() => changeFolder("sent")}
            />
            <FolderButton
              label="Brouillons"
              icon={PenLine}
              count={counts.draft}
              tone={counts.draft > 0 ? "red" : undefined}
              emphasize={counts.draft > 0}
              active={folder === "draft"}
              onClick={() => changeFolder("draft")}
            />
            <FolderButton
              label="Archivés"
              icon={Archive}
              count={counts.archive}
              active={folder === "archive"}
              onClick={() => changeFolder("archive")}
            />
            <div aria-hidden="true" className="mx-2 my-1.5 hidden h-px bg-border xl:block" />
            <FolderButton
              label="Spam"
              icon={ShieldBan}
              count={counts.spam}
              active={folder === "spam"}
              onClick={() => changeFolder("spam")}
            />
            <FolderButton
              label="Corbeille"
              icon={Trash2}
              count={counts.trash}
              active={folder === "trash"}
              onClick={() => changeFolder("trash")}
            />
          </nav>

          <Link
            href="/emails/filtres"
            className="hidden items-center gap-2.5 rounded-[16px] border border-border bg-card px-3.5 py-3 text-foreground transition-colors hover:border-border-strong hover:bg-navy-50 xl:flex"
          >
            <span aria-hidden="true" className="flex text-mail-700">
              <ShieldCheck className="size-[18px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-bold">Filtres anti-spam</span>
              {spamSummary && (
                <span className="text-xs text-muted-foreground">
                  {spamSummary.active} règle{spamSummary.active > 1 ? "s" : ""} active
                  {spamSummary.active > 1 ? "s" : ""} · {spamSummary.blocked} bloqué
                  {spamSummary.blocked > 1 ? "s" : ""}
                </span>
              )}
            </span>
          </Link>
        </div>

        {/* Liste des fils */}
        <section
          ref={listRef}
          aria-label={FOLDER_TITLE[folder]}
          className="flex min-w-0 scroll-mt-4 flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-arena lg:h-[calc(100dvh-7rem)] lg:min-h-[520px]"
        >
          <div className="flex flex-col gap-3 border-b border-border p-4 pb-3">
            <div className="flex flex-wrap items-baseline justify-between gap-1.5">
              <h2 className="font-display text-xl font-extrabold tracking-[-0.02em] text-foreground">
                {FOLDER_TITLE[folder]}
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {folderMeta[folder]}
              </span>
            </div>
            <div className="relative">
              <label htmlFor="mail-search" className="sr-only">
                Rechercher dans les mails
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="mail-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (objet, contact, contenu)…"
                className={cn(FIELD_CLASS, "h-10 bg-ground pl-10")}
              />
            </div>

            {/* Barre de sélection multiple */}
            {filteredThreads.length > 0 && (
              <div className="flex min-h-8 flex-wrap items-center gap-1.5">
                <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-[10px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground hover:bg-navy-50">
                  <input
                    type="checkbox"
                    checked={allVisibleChecked}
                    onChange={toggleAllVisible}
                    className="size-4 cursor-pointer accent-navy-700"
                  />
                  {allVisibleChecked ? "Tout désélectionner" : "Tout sélectionner"}
                </label>
                {visibleCheckedIds.length > 0 && (
                  <>
                    <span className="px-1 text-xs font-extrabold text-foreground">
                      {visibleCheckedIds.length} sélectionné
                      {visibleCheckedIds.length > 1 ? "s" : ""}
                    </span>
                    {inSpam ? (
                      <BulkButton
                        tone="green"
                        icon={ShieldCheck}
                        onClick={handleBulkNotSpam}
                        disabled={bulkPending}
                        title="Remettre dans la boîte de réception et désactiver le filtre"
                      >
                        Pas un spam
                      </BulkButton>
                    ) : inTrash ? (
                      <BulkButton
                        tone="green"
                        icon={RotateCcw}
                        onClick={handleBulkRestore}
                        disabled={bulkPending}
                        title="Restaurer la sélection"
                      >
                        Restaurer
                      </BulkButton>
                    ) : (
                      <>
                        {folder === "inbox" && (
                          <BulkButton
                            tone="blue"
                            icon={MailOpen}
                            onClick={handleBulkRead}
                            disabled={bulkPending}
                            title="Marquer la sélection comme lue"
                          >
                            Lu
                          </BulkButton>
                        )}
                        {inArchive ? (
                          <BulkButton
                            tone="navy"
                            icon={ArchiveRestore}
                            onClick={handleBulkUnarchive}
                            disabled={bulkPending}
                            title="Remettre la sélection dans la boîte"
                          >
                            Remettre en boîte
                          </BulkButton>
                        ) : (
                          <BulkButton
                            tone="navy"
                            icon={Archive}
                            onClick={handleBulkArchive}
                            disabled={bulkPending}
                            title="Archiver la sélection"
                          >
                            Archiver
                          </BulkButton>
                        )}
                        <BulkButton
                          tone="gold"
                          icon={ShieldBan}
                          onClick={handleBulkSpam}
                          disabled={bulkPending}
                          title="Signaler comme spam (bloque les expéditeurs)"
                        >
                          Spam
                        </BulkButton>
                        <BulkButton
                          tone="red"
                          icon={Trash2}
                          onClick={handleBulkDelete}
                          disabled={bulkPending}
                          title="Mettre la sélection à la corbeille"
                        >
                          Corbeille
                        </BulkButton>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={bulkPending}
                      aria-label="Annuler la sélection"
                      title="Annuler la sélection"
                      className="flex size-8 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground disabled:opacity-50"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </>
                )}
                {(inSpam || inTrash) && (
                  <button
                    type="button"
                    onClick={inSpam ? handleEmptySpam : handleEmptyTrash}
                    disabled={bulkPending}
                    className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-bold text-alert-700 transition-colors hover:bg-alert-50 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    {inSpam ? "Vider le spam" : "Vider la corbeille"}
                  </button>
                )}
              </div>
            )}
          </div>

          <ul className="max-h-[60vh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
            {filteredThreads.length === 0 ? (
              <li className="p-4">
                <FolderEmpty folder={folder} searching={!!search.trim()} />
              </li>
            ) : (
              filteredThreads.map((t) => (
                <ThreadListItem
                  key={t.threadId}
                  thread={t}
                  folder={folder}
                  nowMs={nowMs}
                  hasUnread={isThreadUnread(t)}
                  isSelected={selectedThreadId === t.threadId}
                  isChecked={checkedIds.has(t.threadId)}
                  onToggleCheck={() => toggleChecked(t.threadId)}
                  onSelect={() => handleSelectThread(t.threadId)}
                />
              ))
            )}
          </ul>
          <p className="border-t border-border bg-ground px-4 py-2.5 text-xs text-muted-foreground">
            80 derniers mails chargés par dossier · actualisation auto toutes les 30 s
          </p>
        </section>

        {/* Lecture du thread sélectionné */}
        <section
          ref={readerRef}
          aria-label="Lecture du fil"
          className="min-w-0 scroll-mt-4 rounded-[20px] border border-border bg-card shadow-arena lg:h-[calc(100dvh-7rem)] lg:min-h-[520px] lg:overflow-y-auto"
        >
          {selectedThread ? (
            <>
              <div className="border-b border-border px-4 pt-3 pb-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedThreadId(null);
                    scrollTo(listRef.current, true);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-bold text-foreground hover:bg-navy-50"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Retour à la liste
                </button>
              </div>
              <ThreadDetail
                key={`${selectedThread.threadId}:${intentFor(selectedThread.threadId)?.nonce ?? 0}`}
                thread={selectedThread}
                currentUserEmail={currentUserEmail}
                isAdmin={isAdmin}
                folder={folder}
                initialMode={intentFor(selectedThread.threadId)?.mode ?? null}
                onLeave={() => setSelectedThreadId(null)}
              />
            </>
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-[16px] bg-mail-50 text-mail-700"
              >
                <MailOpen className="size-7" strokeWidth={2} />
              </span>
              <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-foreground">
                Choisis un fil et on attaque
              </h2>
              <p className="max-w-[380px] text-sm leading-relaxed text-muted-foreground">
                {radar[0]
                  ? `Le plus chaud : ${radar[0].title} (${radar[0].tag.toLowerCase()}).`
                  : "Sélectionne une conversation dans la liste pour la lire."}
                {unreadNow > 0
                  ? ` ${unreadNow} mail${unreadNow > 1 ? "s" : ""} non lu${unreadNow > 1 ? "s" : ""} t'attend${unreadNow > 1 ? "ent" : ""} dans la boîte.`
                  : ""}
              </p>
              {radar[0] && (
                <Button type="button" size="lg" onClick={() => openFromRadar(radar[0]!)}>
                  Ouvrir le fil le plus chaud
                </Button>
              )}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

// ===========================================================================
// Défi Inbox zéro, radar, dossiers, liste
// ===========================================================================

function InboxZeroCard({
  unread,
  treated,
  className,
}: {
  unread: number;
  treated: number;
  className?: string;
}) {
  const done = unread === 0;
  const max = Math.max(1, treated + unread);
  const value = done ? max : treated;
  const message = done
    ? "Inbox zéro ! Garde-la vide jusqu'à ce soir et le badge est à toi."
    : unread <= 3
      ? `Plus que ${unread}, tu y es presque !`
      : `Plus que ${unread} à traiter. Badge Inbox zéro à la clé.`;
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-[20px] border border-border bg-card p-4 shadow-arena",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-mail-50 text-mail-700"
        >
          <Inbox className="size-[18px]" />
        </span>
        <p className={cn(CAPS_CLASS, "flex-1")}>Défi Inbox zéro</p>
        <span
          role="img"
          aria-label={done ? "Badge Inbox zéro débloqué" : "Badge Inbox zéro pas encore obtenu"}
          className={cn(
            "flex size-[30px] items-center justify-center rounded-full border-[3px]",
            done
              ? "border-win-500 bg-win-50 text-win-700"
              : "border-border-strong bg-ground text-subtle",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="score-number text-[40px] text-foreground">{unread}</span>
        <span className="text-sm font-semibold text-muted-foreground">
          non lu{unread > 1 ? "s" : ""}
        </span>
      </p>
      <Meter
        value={value}
        max={max}
        tone="teal"
        size="lg"
        label="Progression Inbox zéro"
        valueLabel={
          <span className="text-xs">
            {treated} traité{treated > 1 ? "s" : ""} aujourd&apos;hui · objectif 0
          </span>
        }
      />
      <p
        className={cn(
          "text-[13px] leading-snug font-semibold",
          done ? "text-win-700" : "text-foreground",
        )}
      >
        {message}
      </p>
    </div>
  );
}

function RadarCard({ item, onGo }: { item: RadarItem; onGo: () => void }) {
  const t = TONE_CLASSES[item.tone];
  const Icon = item.icon;
  return (
    <article
      className="relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-[16px] border border-border bg-card p-4 pt-[18px] shadow-arena"
    >
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", t.solid)} />
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-bold",
          t.bg,
          t.text,
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.tag}</span>
      </span>
      <p className="truncate text-base font-extrabold text-foreground">{item.title}</p>
      <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{item.detail}</p>
      <Button type="button" variant="outline" size="sm" onClick={onGo} className="mt-auto h-9 self-stretch">
        {item.cta}
      </Button>
    </article>
  );
}

function FolderEmpty({ folder, searching }: { folder: FolderType; searching: boolean }) {
  if (searching) {
    return (
      <EmptyState
        icon={Search}
        tone="navy"
        title="Aucun résultat"
        description="La recherche couvre les 80 derniers mails chargés de ce dossier. Pour remonter plus loin, passe par la fiche du client."
        className="border-none bg-transparent py-8"
      />
    );
  }
  const map: Record<FolderType, { icon: LucideIcon; tone: Tone; title: string; text: string }> = {
    inbox: {
      icon: Inbox,
      tone: "green",
      title: "Inbox zéro, bravo !",
      text: "Plus rien à traiter. Profites-en pour lancer une session de phoning.",
    },
    sent: {
      icon: Send,
      tone: "teal",
      title: "Aucun mail envoyé",
      text: "Ton premier mail rapporte +3 XP dès qu'il est rattaché à un client.",
    },
    draft: {
      icon: PenLine,
      tone: "gold",
      title: "Aucun brouillon",
      text: "Rien ne traîne : tout est parti.",
    },
    archive: {
      icon: Archive,
      tone: "navy",
      title: "Aucun mail archivé",
      text: "Les conversations archivées restent visibles sur les fiches clients.",
    },
    spam: {
      icon: ShieldCheck,
      tone: "green",
      title: "Aucun spam, boîte propre",
      text: "Les filtres anti-spam veillent pour toi.",
    },
    trash: {
      icon: Trash2,
      tone: "navy",
      title: "La corbeille est vide",
      text: "Les mails mis à la corbeille restent restaurables tant qu'elle n'est pas vidée.",
    },
  };
  const e = map[folder];
  return (
    <EmptyState
      icon={e.icon}
      tone={e.tone}
      title={e.title}
      description={e.text}
      className="border-none bg-transparent py-8"
    />
  );
}

function FolderButton({
  label,
  icon: Icon,
  count,
  countLabel,
  tone,
  active,
  emphasize = false,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  count: number;
  /** Complément lu par les lecteurs d'écran (« non lus »). */
  countLabel?: string;
  /** Pastille colorée (teal : non lus, rouge : brouillons en attente). */
  tone?: "teal" | "red";
  active: boolean;
  /** Gras (non lus / brouillons en attente), comme dans Gmail. */
  emphasize?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[42px] shrink-0 items-center gap-2.5 rounded-[12px] pr-2.5 pl-3 text-left text-sm text-foreground transition-colors xl:w-full",
        active
          ? "bg-mail-50 font-extrabold shadow-[inset_3px_0_0_var(--color-mail-500)]"
          : "font-semibold hover:bg-navy-50",
        emphasize && !active && "font-bold",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap xl:flex-1 xl:truncate">{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums",
            tone === "teal"
              ? "bg-mail-700 text-white"
              : tone === "red"
                ? "bg-alert-50 text-alert-700"
                : "bg-navy-50 text-muted-foreground",
          )}
        >
          {count}
          {countLabel && <span className="sr-only"> {countLabel}</span>}
        </span>
      )}
    </button>
  );
}

function BulkButton({
  tone,
  icon: Icon,
  onClick,
  disabled,
  title,
  children,
}: {
  tone: Tone;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-bold transition-[filter] hover:brightness-95 disabled:opacity-50",
        t.bg,
        t.text,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </button>
  );
}

function ThreadListItem({
  thread,
  folder,
  nowMs,
  hasUnread,
  isSelected,
  isChecked,
  onToggleCheck,
  onSelect,
}: {
  thread: ThreadGroup;
  folder: FolderType;
  nowMs: number;
  hasUnread: boolean;
  isSelected: boolean;
  isChecked: boolean;
  onToggleCheck: () => void;
  onSelect: () => void;
}) {
  const last = thread.last;
  const otherParty =
    last.direction === "ENTRANT"
      ? last.expediteurNom || last.expediteurEmail
      : thread.first.destinataireEmail;
  const prospect = last.prospect;
  const isLead =
    folder === "inbox" &&
    thread.msgs.some((m) => m.direction === "ENTRANT") &&
    !thread.msgs.some((m) => m.prospect);
  const hasDraft = thread.msgs.some(isGenuineDraft);
  const nbAtt = thread.msgs.reduce((s, m) => s + m.attachments.length, 0);
  // Suivi : statut du dernier envoi (hors spam / corbeille) + réponse reçue.
  const lastOut = [...thread.msgs]
    .reverse()
    .find((m) => m.direction === "SORTANT" && !isGenuineDraft(m));
  const replied =
    !!lastOut &&
    thread.msgs.some((m) => m.direction === "ENTRANT" && mailTs(m) > mailTs(lastOut));
  const showTrack =
    folder !== "spam" && folder !== "trash" && !!lastOut && last.direction === "SORTANT";
  const avatarTone: Tone = prospect ? (prospect.statutTone ?? "blue") : "navy";
  const at = TONE_CLASSES[avatarTone];

  return (
    <li
      className={cn(
        "flex gap-2.5 border-b border-navy-50 py-3 pr-3.5 pl-3 transition-colors",
        isSelected
          ? "bg-navy-50 shadow-[inset_4px_0_0_var(--color-navy-700)]"
          : hasUnread
            ? "bg-card shadow-[inset_4px_0_0_var(--color-info-500)] hover:bg-navy-50/60"
            : "bg-ground/70 hover:bg-navy-50/60",
      )}
    >
      <label className="flex cursor-pointer items-start pt-2.5">
        <span className="sr-only">Sélectionner la conversation : {last.objet}</span>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggleCheck}
          className="size-4 cursor-pointer accent-navy-700"
        />
      </label>
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected ? "true" : undefined}
        className="flex min-w-0 flex-1 gap-3 rounded-[8px] text-left text-foreground"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
            prospect ? cn(at.bg, at.text) : "bg-navy-50 text-muted-foreground",
          )}
        >
          {initialsFrom(otherParty)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            {hasUnread && (
              <>
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-info-500" />
                <span className="sr-only">Non lu</span>
              </>
            )}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                hasUnread ? "font-extrabold" : "font-semibold",
              )}
            >
              {last.direction === "SORTANT" ? `À : ${otherParty}` : otherParty}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums",
                hasUnread ? "font-extrabold text-info-700" : "font-medium text-muted-foreground",
              )}
            >
              {mailShortDate(last.envoyeLe ?? last.createdAt, nowMs)}
            </span>
          </span>
          <span
            className={cn("truncate text-[13px]", hasUnread ? "font-bold" : "font-medium")}
          >
            {last.objet}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {last.contenuTexte.slice(0, 120)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {prospect && (
              <span
                className={cn(
                  "inline-flex max-w-[190px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-bold",
                  at.bg,
                  at.text,
                )}
              >
                <Building2 className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{prospect.raisonSociale}</span>
              </span>
            )}
            {isLead && (
              <span className="rounded-full border border-dashed border-coral-400 bg-coral-50 px-2 py-0.5 text-[11px] font-bold text-coral-600">
                Lead à capter
              </span>
            )}
            {showTrack && lastOut && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold",
                  TONE_CLASSES[STATUT_TONE[lastOut.statut] ?? "navy"].bg,
                  TONE_CLASSES[STATUT_TONE[lastOut.statut] ?? "navy"].text,
                )}
              >
                {STATUT_LABEL[lastOut.statut] ?? lastOut.statut}
              </span>
            )}
            {folder === "sent" && replied && (
              <span className="rounded-full bg-lvl-50 px-2 py-0.5 text-[11px] font-bold text-lvl-700">
                A répondu
              </span>
            )}
            {nbAtt > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground">
                <Paperclip className="size-3" aria-hidden="true" />
                {nbAtt}
                <span className="sr-only"> pièce(s) jointe(s)</span>
              </span>
            )}
            {thread.msgs.length > 1 && (
              <span className="min-w-[18px] rounded-full bg-navy-50 px-1.5 py-0.5 text-center text-[11px] font-extrabold text-navy-600">
                {thread.msgs.length}
                <span className="sr-only"> messages</span>
              </span>
            )}
            {/* Comme Gmail : « Brouillon » en rouge si un brouillon attend dans le fil. */}
            {hasDraft && (
              <span className="text-[11px] font-extrabold text-alert-700">Brouillon</span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

// ===========================================================================
// Brouillon (fil d'un seul message enregistré volontairement)
// ===========================================================================

/**
 * Éditeur de brouillon : terminer un message enregistré, modifier ses pièces
 * jointes, le ré-enregistrer ou l'envoyer maintenant.
 */
function DraftEditor({ draft }: { draft: InboxEmail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [objet, setObjet] = useState(
    draft.objet === "(brouillon sans objet)" ? "" : draft.objet,
  );
  const [contenuHtml, setContenuHtml] = useState(draft.contenuHtml);
  const contenu = htmlToPlainText(contenuHtml);
  const [attachments, setAttachments] = useState<PickedAttachment[]>(
    draft.attachments.map((a) => ({
      url: a.url,
      filename: a.nom,
      mimeType: a.mimeType,
      size: a.taille,
    })),
  );
  const [cc, setCc] = useState(draft.cc ?? "");
  const [bcc, setBcc] = useState(draft.bcc ?? "");
  const [showCc, setShowCc] = useState(!!(draft.cc || draft.bcc));

  // Destinataire figé (stocké dans le brouillon) : client lié ou adresse libre.
  // Cc/Cci renvoyés à chaque enregistrement (vides = retirés).
  const recipientArgs = {
    ...(draft.prospect
      ? { prospectId: draft.prospect.id }
      : { to: draft.destinataireEmail }),
    cc: cc.trim(),
    bcc: bcc.trim(),
  };

  const handleSaveDraft = () => {
    if (!objet.trim() && !contenu.trim()) {
      toast.error("Rien à enregistrer.");
      return;
    }
    startTransition(async () => {
      const res = await saveEmailDraft({
        draftId: draft.id,
        ...recipientArgs,
        objet: objet.trim(),
        contenu: contenu.trim(),
        contenuHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success("Brouillon mis à jour.");
      router.refresh();
    });
  };

  const handleSendNow = () => {
    if (!contenu.trim()) {
      toast.error("Le brouillon est vide.");
      return;
    }
    startTransition(async () => {
      // On enregistre d'abord les dernières modifs, puis on envoie.
      const saved = await saveEmailDraft({
        draftId: draft.id,
        ...recipientArgs,
        objet: objet.trim(),
        contenu: contenu.trim(),
        contenuHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      if (!saved.ok) {
        toast.error(uiText(saved.error, "Échec de l'enregistrement."));
        return;
      }
      const res = await sendDraft(draft.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de l'envoi."));
        return;
      }
      if (res.dryRun) {
        toast.success("Brouillon (dry-run, pas d'envoi réel).");
      } else if (draft.prospect) {
        // Envoi réel d'un brouillon lié à un client : activité EMAIL_ENVOYE.
        xpToast(XP_RULES.email, "Brouillon envoyé !", `à ${draft.prospect.raisonSociale}`);
      } else {
        toast.success("Brouillon envoyé.");
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Supprimer ce brouillon ?")) return;
    startTransition(async () => {
      const res = await deleteEmail(draft.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success("Brouillon supprimé.");
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="gold" icon={PenLine}>
            Brouillon
          </StatusPill>
          <span className="text-xs font-semibold text-muted-foreground">
            commencé le {mailDateTime(draft.createdAt)}
          </span>
        </div>
        <h2 className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] break-words text-foreground">
          {objet.trim() || "(sans objet)"}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-9 text-xs font-bold text-muted-foreground">À</span>
          <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-info-50 py-1 pr-3 pl-1 text-[13px] font-bold text-info-700">
            <span
              aria-hidden="true"
              className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-extrabold"
            >
              {initialsFrom(draft.prospect?.raisonSociale ?? draft.destinataireEmail)}
            </span>
            <span className="truncate">
              {draft.prospect
                ? draft.prospect.raisonSociale
                : draft.destinataireEmail || "Destinataire à choisir"}
            </span>
          </span>
          {draft.prospect ? (
            <XpPill xp={XP_RULES.email} label="à l'envoi" />
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
        {!showCc ? (
          <button
            type="button"
            onClick={() => setShowCc(true)}
            className="inline-flex h-8 items-center rounded-[10px] bg-navy-50 px-2.5 text-xs font-bold text-navy-600 hover:bg-navy-100"
          >
            + Cc / Cci
          </button>
        ) : (
          <CcBccFields cc={cc} bcc={bcc} onCc={setCc} onBcc={setBcc} disabled={pending} idPrefix={`draft-${draft.id}`} />
        )}
        <div className="space-y-1.5">
          <label htmlFor={`draft-objet-${draft.id}`} className="text-xs font-bold text-muted-foreground">
            Sujet
          </label>
          <input
            id={`draft-objet-${draft.id}`}
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            placeholder="Sujet du message"
            className={FIELD_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground">Message</p>
          <RichTextEditor
            initialHtml={draft.contenuHtml}
            onChange={setContenuHtml}
            disabled={pending}
            placeholder="Écris ton message…"
            variables={draft.prospect ? MAIL_VARIABLES : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground">Pièces jointes</p>
          <AttachmentPicker
            value={attachments}
            onChange={setAttachments}
            disabled={pending}
          />
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3 sm:px-6">
        <Button type="button" variant="hero" onClick={handleSendNow} disabled={pending}>
          <Send aria-hidden="true" />
          {pending ? "Envoi…" : "Envoyer"}
          {draft.prospect && (
            <XpPill xp={XP_RULES.email} variant="solid" className="text-shadow-none" />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleSaveDraft}
          disabled={pending}
        >
          <Save aria-hidden="true" />
          Enregistrer
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={handleDelete}
          disabled={pending}
          className="ml-auto text-alert-700 hover:bg-alert-50 hover:text-alert-700"
        >
          <Trash2 aria-hidden="true" />
          Supprimer
        </Button>
      </div>
    </div>
  );
}

/** Champs Cc / Cci (suggestions clients via RecipientInput). */
function CcBccFields({
  cc,
  bcc,
  onCc,
  onBcc,
  disabled,
  idPrefix,
}: {
  cc: string;
  bcc: string;
  onCc: (v: string) => void;
  onBcc: (v: string) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-ground p-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
        <label htmlFor={`${idPrefix}-cc`} className="w-9 shrink-0 text-xs font-bold text-muted-foreground">
          Cc
        </label>
        <div className="min-w-0 flex-1">
          <RecipientInput
            id={`${idPrefix}-cc`}
            value={cc}
            onChange={onCc}
            placeholder="Nom, entreprise ou email (plusieurs : séparés par une virgule)"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
        <label htmlFor={`${idPrefix}-bcc`} className="w-9 shrink-0 text-xs font-bold text-muted-foreground">
          Cci
        </label>
        <div className="min-w-0 flex-1">
          <RecipientInput
            id={`${idPrefix}-bcc`}
            value={bcc}
            onChange={onBcc}
            placeholder="Copie cachée : copie.cachee@exemple.ch"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

/** Aperçu (lecture seule) de la signature ajoutée automatiquement à l'envoi. */
function SignaturePreview({ html }: { html: string }) {
  if (!html) return null;
  return (
    <div className="border-t border-dashed border-border bg-ground px-4 py-2.5">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Signature ajoutée automatiquement à l&apos;envoi
      </p>
      <div className="text-xs" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ===========================================================================
// Lecture d'un fil
// ===========================================================================

function ThreadDetail({
  thread,
  currentUserEmail,
  isAdmin,
  folder,
  initialMode = null,
  onLeave,
}: {
  thread: ThreadGroup;
  currentUserEmail: string;
  isAdmin: boolean;
  folder: FolderType;
  /** « reply » : ouvre directement la réponse (depuis le radar). */
  initialMode?: "reply" | null;
  /** Appelé quand le fil quitte le dossier courant (archivé, spam…). */
  onLeave: () => void;
}) {
  const inTrash = folder === "trash";
  const inSpam = folder === "spam";
  const inArchive = folder === "archive";

  // Brouillon de RÉPONSE dans un fil existant : affiché à part (bandeau
  // « Reprendre »), pas comme un message de la conversation.
  const replyDraft =
    !inTrash && !inSpam && thread.msgs.length > 1
      ? (thread.msgs.find(isGenuineDraft) ?? null)
      : null;

  const [showReply, setShowReply] = useState(initialMode === "reply" && !replyDraft);
  const [replyHtml, setReplyHtml] = useState("");
  // HTML initial de l'éditeur de réponse (vide, ou le brouillon repris).
  const [replyInitial, setReplyInitial] = useState("");
  // Brouillon de réponse en cours d'édition (null = nouvelle réponse).
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [replyKey, setReplyKey] = useState(0);
  const [replyAttachments, setReplyAttachments] = useState<PickedAttachment[]>([]);
  const [showReplyCc, setShowReplyCc] = useState(false);
  const [replyCc, setReplyCc] = useState("");
  const [replyBcc, setReplyBcc] = useState("");
  // Transfert : panneau distinct de la réponse (destinataire libre).
  const [showForward, setShowForward] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardHtml, setForwardHtml] = useState("");
  const [forwardKey, setForwardKey] = useState(0);
  const [forwardPJ, setForwardPJ] = useState(true);
  const [forwardAttachments, setForwardAttachments] = useState<
    PickedAttachment[]
  >([]);
  const [showForwardCc, setShowForwardCc] = useState(false);
  const [forwardCc, setForwardCc] = useState("");
  const [forwardBcc, setForwardBcc] = useState("");
  // Aperçu (lecture seule) de la signature ajoutée automatiquement à l'envoi.
  const [sigHtml, setSigHtml] = useState("");
  useEffect(() => {
    void getMyDefaultSignatureHtml().then(setSigHtml);
  }, []);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const replyText = htmlToPlainText(replyHtml);
  const composerRef = useRef<HTMLDivElement>(null);

  // Ouvert depuis le radar avec la réponse prête : on amène la zone de
  // réponse à l'écran (simple défilement, aucun état modifié).
  useEffect(() => {
    if (initialMode === "reply") {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [initialMode]);

  // Un thread d'un seul message qui est un vrai brouillon → éditeur dédié
  // (terminer / modifier / envoyer plus tard). Pas dans la corbeille ni le spam.
  const draftMsg =
    !inTrash &&
    !inSpam &&
    thread.msgs.length === 1 &&
    isGenuineDraft(thread.msgs[0]!)
      ? thread.msgs[0]!
      : null;

  const visibleMsgs = replyDraft
    ? thread.msgs.filter((m) => m.id !== replyDraft.id)
    : thread.msgs;
  // Dernier VRAI message du fil : c'est à lui qu'on répond / qu'on transfère.
  const lastReal = visibleMsgs[visibleMsgs.length - 1] ?? thread.last;
  const replyRecipient =
    lastReal.direction === "ENTRANT"
      ? lastReal.expediteurEmail
      : lastReal.destinataireEmail;
  const replyName =
    lastReal.direction === "ENTRANT"
      ? lastReal.expediteurNom || lastReal.expediteurEmail
      : (lastReal.prospect?.raisonSociale ?? lastReal.destinataireEmail);
  const replyObjet = (() => {
    const base = thread.msgs[0]!.objet.trim();
    return /^re\s*:/i.test(base) ? base : `Re: ${base}`;
  })();
  // Un envoi dans un fil lié à un client crée l'activité EMAIL_ENVOYE (+3 XP).
  const linkedForXp = !!lastReal.prospect;

  const scrollToComposer = () =>
    requestAnimationFrame(() =>
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );

  const resetReply = () => {
    setShowReply(false);
    setReplyHtml("");
    setReplyInitial("");
    setEditingDraftId(null);
    setReplyKey((k) => k + 1);
    setReplyAttachments([]);
    setReplyCc("");
    setReplyBcc("");
    setShowReplyCc(false);
  };

  const openReply = () => {
    setShowForward(false);
    setReplyHtml("");
    setReplyInitial("");
    setEditingDraftId(null);
    setReplyKey((k) => k + 1);
    setShowReply(true);
    scrollToComposer();
  };

  /** Reprend le brouillon de réponse dans l'éditeur (contenu, PJ, Cc/Cci). */
  const resumeReplyDraft = () => {
    if (!replyDraft) return;
    setShowForward(false);
    setReplyInitial(replyDraft.contenuHtml);
    setReplyHtml(replyDraft.contenuHtml);
    setEditingDraftId(replyDraft.id);
    setReplyAttachments(
      replyDraft.attachments.map((a) => ({
        url: a.url,
        filename: a.nom,
        mimeType: a.mimeType,
        size: a.taille,
      })),
    );
    setReplyCc(replyDraft.cc ?? "");
    setReplyBcc(replyDraft.bcc ?? "");
    setShowReplyCc(!!(replyDraft.cc || replyDraft.bcc));
    setReplyKey((k) => k + 1);
    setShowReply(true);
    scrollToComposer();
  };

  const openForward = () => {
    setShowReply(false);
    setForwardHtml("");
    setForwardKey((k) => k + 1);
    setForwardAttachments([]);
    setShowForward(true);
    scrollToComposer();
  };

  if (draftMsg) {
    return <DraftEditor key={draftMsg.id} draft={draftMsg} />;
  }

  /** Enregistre (ou met à jour) la réponse en brouillon, dans le même fil. */
  const saveReplyDraft = async () =>
    saveEmailDraft({
      ...(editingDraftId
        ? { draftId: editingDraftId }
        : { replyToEmailId: lastReal.id }),
      objet: replyObjet,
      contenu: replyText.trim(),
      contenuHtml: replyHtml,
      attachments: replyAttachments.length > 0 ? replyAttachments : undefined,
      cc: replyCc.trim(),
      bcc: replyBcc.trim(),
    });

  const handleSaveReplyDraft = () => {
    if (!replyText.trim()) {
      toast.error("Écris un contenu avant d'enregistrer le brouillon.");
      return;
    }
    startTransition(async () => {
      const res = await saveReplyDraft();
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de l'enregistrement."));
        return;
      }
      toast.success("Brouillon enregistré : retrouve-le dans « Brouillons ».");
      resetReply();
      router.refresh();
    });
  };

  const handleDeleteReplyDraft = () => {
    if (!replyDraft) return;
    if (!confirm("Supprimer ce brouillon de réponse ?")) return;
    startTransition(async () => {
      const res = await deleteEmail(replyDraft.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success("Brouillon supprimé.");
      resetReply();
      router.refresh();
    });
  };

  const handleSend = () => {
    if (!replyText.trim()) {
      toast.error("Écris un contenu.");
      return;
    }
    startTransition(async () => {
      let res;
      let earnsXp = linkedForXp;
      if (editingDraftId) {
        // Brouillon repris : on enregistre les dernières modifs puis on l'envoie
        // (il reste dans le fil, In-Reply-To conservé).
        const saved = await saveReplyDraft();
        if (!saved.ok) {
          toast.error(uiText(saved.error, "Échec de l'enregistrement."));
          return;
        }
        res = await sendDraft(editingDraftId);
        // sendDraft ne crée l'activité qu'en envoi réel, brouillon lié à un client.
        // (le brouillon repris EST replyDraft : c'est son client qui compte).
        earnsXp = !res.dryRun && !!replyDraft?.prospect;
      } else {
        res = await replyToEmail(
          lastReal.id,
          replyText.trim(),
          undefined,
          replyAttachments.length > 0 ? replyAttachments : undefined,
          replyHtml,
          replyCc.trim() || undefined,
          replyBcc.trim() || undefined,
        );
      }
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec d'envoi."));
        return;
      }
      if (earnsXp) {
        xpToast(
          XP_RULES.email,
          res.dryRun ? "Réponse enregistrée (dry-run)" : "Réponse envoyée !",
          `à ${replyName}`,
        );
      } else {
        toast.success(res.dryRun ? "Réponse enregistrée (dry-run)." : "Réponse envoyée.");
      }
      resetReply();
      router.refresh();
    });
  };

  const closeForward = () => {
    setShowForward(false);
    setForwardTo("");
    setForwardHtml("");
    setForwardKey((k) => k + 1);
    setForwardPJ(true);
    setForwardAttachments([]);
    setForwardCc("");
    setForwardBcc("");
    setShowForwardCc(false);
  };

  const handleForward = () => {
    if (!forwardTo.trim()) {
      toast.error("Indique un destinataire.");
      return;
    }
    startTransition(async () => {
      const res = await forwardEmail({
        emailId: lastReal.id,
        to: forwardTo.trim(),
        contenu: htmlToPlainText(forwardHtml).trim(),
        contenuHtml: forwardHtml,
        inclurePiecesJointes: forwardPJ,
        attachments:
          forwardAttachments.length > 0 ? forwardAttachments : undefined,
        cc: forwardCc.trim() || undefined,
        bcc: forwardBcc.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec du transfert."));
        return;
      }
      if (linkedForXp) {
        xpToast(
          XP_RULES.email,
          res.dryRun ? "Transfert enregistré (dry-run)" : "Message transféré !",
          `à ${forwardTo.trim()}`,
        );
      } else {
        toast.success(
          res.dryRun ? "Transfert enregistré (dry-run)." : "Message transféré.",
        );
      }
      closeForward();
      router.refresh();
    });
  };

  // ---- Actions du fil entier (en haut de la lecture) ----
  const anyProspect = thread.msgs.some((m) => m.prospect);
  const hasInbound = thread.msgs.some((m) => m.direction === "ENTRANT");

  const handleArchiveThread = () => {
    if (
      !confirm(
        "Archiver cette conversation ? Elle quitte la boîte de réception (toujours visible sur la fiche client et dans Archivés).",
      )
    )
      return;
    startTransition(async () => {
      const res = await archiveThread(thread.threadId);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de l'archivage."));
        return;
      }
      toast.success("Conversation archivée.");
      onLeave();
      router.refresh();
    });
  };

  const handleUnarchiveThread = () => {
    startTransition(async () => {
      for (const m of thread.msgs) {
        const res = await setEmailArchive(m.id, false);
        if (!res.ok) {
          toast.error(uiText(res.error, "Échec du désarchivage."));
          return;
        }
      }
      toast.success("Conversation remise dans la boîte.");
      onLeave();
      router.refresh();
    });
  };

  const handleSpamThread = () => {
    if (
      !confirm(
        "Signaler cette conversation comme spam ?\n\nL'expéditeur sera bloqué : ses mails actuels et futurs iront dans le dossier Spam (récupérables via « Pas un spam »).",
      )
    )
      return;
    startTransition(async () => {
      const res = await markThreadsAsSpam([thread.threadId]);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(`${res.moved ?? 0} message(s) déplacé(s) dans Spam.`);
      onLeave();
      router.refresh();
    });
  };

  const handleTrashThread = () => {
    if (!confirm("Mettre cette conversation à la corbeille ? Tu pourras la restaurer.")) return;
    startTransition(async () => {
      const res = await deleteThreadsBulk([thread.threadId]);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de la suppression."));
        return;
      }
      toast.success("Conversation mise à la corbeille.");
      onLeave();
      router.refresh();
    });
  };

  // Pièces jointes de l'original : pour proposer (ou non) de les réexpédier.
  const nbPJ = lastReal.attachments?.length ?? 0;

  // Suivi du dernier envoi (Envoyé → Livré → Ouvert → Cliqué) + réponse reçue.
  const lastOut = [...visibleMsgs]
    .reverse()
    .find((m) => m.direction === "SORTANT" && !isGenuineDraft(m));
  const repliedAfter =
    !!lastOut &&
    visibleMsgs.some((m) => m.direction === "ENTRANT" && mailTs(m) > mailTs(lastOut));

  const prospect = thread.last.prospect;
  const isLead = hasInbound && !anyProspect && !inSpam && !inTrash;
  const prefillEmail =
    thread.last.direction === "ENTRANT"
      ? thread.last.expediteurEmail
      : thread.last.destinataireEmail;
  const prefillName =
    thread.last.direction === "ENTRANT" ? (thread.last.expediteurNom ?? null) : null;

  const canCompose = !inSpam && !inTrash;

  return (
    <div className="flex flex-col">
      {/* En-tête du fil */}
      <div className="flex flex-col gap-3.5 border-b border-border px-4 pt-4 pb-4 sm:px-6">
        {canCompose && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={replyDraft ? resumeReplyDraft : openReply}
              >
                {replyDraft ? <PenLine aria-hidden="true" /> : <Reply aria-hidden="true" />}
                {replyDraft ? "Reprendre le brouillon" : "Répondre"}
              </Button>
              <Button type="button" variant="outline" onClick={openForward}>
                <Forward aria-hidden="true" />
                Transférer
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {inArchive ? (
                <IconAction
                  label="Remettre dans la boîte"
                  icon={ArchiveRestore}
                  onClick={handleUnarchiveThread}
                  disabled={pending}
                />
              ) : (
                <IconAction
                  label="Archiver la conversation"
                  icon={Archive}
                  onClick={handleArchiveThread}
                  disabled={pending}
                />
              )}
              {hasInbound && !anyProspect && (
                <IconAction
                  label="Bloquer l'expéditeur (spam)"
                  icon={ShieldBan}
                  onClick={handleSpamThread}
                  disabled={pending}
                  className="text-gold-700"
                />
              )}
              <IconAction
                label="Mettre la conversation à la corbeille"
                icon={Trash2}
                onClick={handleTrashThread}
                disabled={pending}
                className="text-alert-700"
              />
            </div>
          </div>
        )}

        {inSpam && <SpamActionsBar thread={thread} onRefresh={() => router.refresh()} />}
        {inTrash && <TrashActionsBar thread={thread} onRefresh={() => router.refresh()} />}

        <h2 className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] break-words text-foreground">
          {thread.msgs[0]!.objet}
        </h2>

        {/* Entreprise CRM liée / lead à capter */}
        {prospect ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-ground px-3.5 py-3">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-extrabold",
                TONE_CLASSES[prospect.statutTone ?? "blue"].bg,
                TONE_CLASSES[prospect.statutTone ?? "blue"].text,
              )}
            >
              {initialsFrom(prospect.raisonSociale)}
            </span>
            <div className="min-w-0 flex-[1_1_180px]">
              <p className="text-[15px] font-extrabold break-words text-foreground">
                {prospect.raisonSociale}
                {prospect.ville && (
                  <span className="text-[13px] font-medium text-muted-foreground">
                    {" "}
                    · {prospect.ville}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Entreprise liée dans le CRM</p>
            </div>
            {prospect.statutLabel && (
              <StatusPill tone={prospect.statutTone ?? "blue"}>{prospect.statutLabel}</StatusPill>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href={`/prospects/${prospect.id}`}
                className="inline-flex h-9 items-center rounded-[12px] border border-border-strong bg-card px-3 text-[13px] font-bold text-foreground transition-colors hover:bg-navy-50"
              >
                Ouvrir la fiche
              </Link>
              <AttachProspectButton
                emailId={thread.last.id}
                currentProspectId={prospect.id}
                prefillEmail={prefillEmail}
                prefillName={prefillName}
                onDone={() => {
                  /* le router.refresh() est dans le composant */
                }}
              />
            </div>
          </div>
        ) : isLead ? (
          <div className="flex flex-col gap-2 rounded-[14px] border border-dashed border-coral-400 bg-coral-50 p-3.5">
            <p className="text-sm font-extrabold text-coral-600">
              Lead à capter : ce mail n&apos;est rattaché à aucune entreprise
            </p>
            <p className="text-[13px] leading-snug text-muted-foreground">
              Rattache-le : il apparaîtra sur la fiche et dans ton historique, et chaque
              réponse rapportera +3 XP. Email de l&apos;expéditeur pré-rempli :{" "}
              <strong className="font-bold text-foreground">{prefillEmail}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <AttachProspectButton
                emailId={thread.last.id}
                currentProspectId={null}
                prefillEmail={prefillEmail}
                prefillName={prefillName}
                variant="primary"
                onDone={() => {
                  /* le router.refresh() est dans le composant */
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-muted-foreground">Client :</span>
            <span className="text-muted-foreground italic">Non attribué</span>
            <AttachProspectButton
              emailId={thread.last.id}
              currentProspectId={null}
              prefillEmail={prefillEmail}
              prefillName={prefillName}
              onDone={() => {
                /* le router.refresh() est dans le composant */
              }}
            />
          </div>
        )}

        {/* Archivage sous une collaboratrice : réservé à l'admin (trace des
            échanges, ex. recrutement). N'affecte pas la boîte ni le client. */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 font-bold text-muted-foreground">
              <Users className="size-3.5" aria-hidden="true" />
              Collaboratrice :
            </span>
            {thread.last.collaborateur ? (
              <Link
                href={`/rh/${thread.last.collaborateur.id}`}
                className="rounded-full bg-navy-100 px-2.5 py-0.5 font-bold text-navy-700 hover:bg-navy-50"
              >
                {thread.last.collaborateur.name}
              </Link>
            ) : (
              <span className="text-muted-foreground italic">Non archivé</span>
            )}
            <AttachCollaborateurButton
              emailId={thread.last.id}
              currentCollaborateurId={thread.last.collaborateur?.id ?? null}
            />
          </div>
        )}

        {/* Suivi du dernier envoi */}
        {lastOut && !inSpam && !inTrash && (
          <SendTracking msg={lastOut} replied={repliedAfter} />
        )}
      </div>

      {/* Timeline messages */}
      <div className="flex flex-col gap-3.5 bg-ground px-3 py-4 sm:px-6 sm:py-5">
        {visibleMsgs.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isMine={
              m.direction === "SORTANT" &&
              m.expediteurEmail.toLowerCase() === currentUserEmail.toLowerCase()
            }
            inTrash={inTrash || inSpam}
            inSpam={inSpam}
            inArchive={inArchive}
            onRefresh={() => router.refresh()}
          />
        ))}
      </div>

      {/* Zone de réponse (absente du Spam et de la Corbeille) */}
      {canCompose && (
        <div
          ref={composerRef}
          id={`reponse-${thread.threadId}`}
          className="scroll-mt-4 border-t border-border px-4 pt-4 pb-5 sm:px-6"
        >
          {!showReply && !showForward ? (
            <div className="space-y-3">
              {replyDraft && (
                <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-gold-50 px-3 py-2.5">
                  <span className="min-w-0 flex-[1_1_200px] text-[13px] font-bold text-gold-700">
                    Brouillon de réponse enregistré le {mailDateTime(replyDraft.createdAt)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resumeReplyDraft}
                    disabled={pending}
                  >
                    Reprendre
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteReplyDraft}
                    disabled={pending}
                    className="text-alert-700 hover:bg-alert-50 hover:text-alert-700"
                  >
                    Supprimer
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={replyDraft ? resumeReplyDraft : openReply}
                  className="flex-1"
                  variant="outline"
                  size="lg"
                >
                  {replyDraft ? <PenLine aria-hidden="true" /> : <Reply aria-hidden="true" />}
                  {replyDraft ? "Reprendre le brouillon" : "Répondre"}
                </Button>
                <Button
                  type="button"
                  onClick={openForward}
                  className="flex-1"
                  variant="outline"
                  size="lg"
                >
                  <Forward aria-hidden="true" />
                  Transférer
                </Button>
              </div>
              {linkedForXp ? (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <XpPill xp={XP_RULES.email} /> à chaque mail envoyé dans ce fil
                </p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">
                  Rattache ce fil à un client : chaque mail envoyé rapportera +3 XP.
                </p>
              )}
            </div>
          ) : showForward ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-extrabold tracking-[-0.02em] text-foreground">
                  Transférer le message
                </h3>
                {linkedForXp && <XpPill xp={XP_RULES.email} label="à l'envoi" />}
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor={`fwd-to-${thread.threadId}`}
                  className="text-xs font-bold text-muted-foreground"
                >
                  Transférer à
                </label>
                <RecipientInput
                  id={`fwd-to-${thread.threadId}`}
                  value={forwardTo}
                  onChange={setForwardTo}
                  multiple={false}
                  placeholder="Client, contact ou adresse@exemple.ch"
                  disabled={pending}
                  autoFocus
                  className="h-11"
                />
              </div>

              {!showForwardCc ? (
                <button
                  type="button"
                  onClick={() => setShowForwardCc(true)}
                  aria-expanded={false}
                  className="inline-flex h-8 items-center rounded-[10px] bg-navy-50 px-2.5 text-xs font-bold text-navy-600 hover:bg-navy-100"
                >
                  + Cc / Cci
                </button>
              ) : (
                <CcBccFields
                  cc={forwardCc}
                  bcc={forwardBcc}
                  onCc={setForwardCc}
                  onBcc={setForwardBcc}
                  disabled={pending}
                  idPrefix={`fwd-${thread.threadId}`}
                />
              )}

              <RichTextEditor
                key={forwardKey}
                onChange={setForwardHtml}
                disabled={pending}
                placeholder="Ajoute un mot (facultatif)…"
                minHeightClass="min-h-[100px]"
                ariaLabel="Mot d'accompagnement du transfert"
                footer={<SignaturePreview html={sigHtml} />}
              />

              <p className="text-xs text-muted-foreground">
                Le message d&apos;origine est cité automatiquement en dessous.
              </p>

              {nbPJ > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={forwardPJ}
                    onChange={(e) => setForwardPJ(e.target.checked)}
                    disabled={pending}
                    className="size-4 cursor-pointer accent-navy-700"
                  />
                  Joindre les {nbPJ} pièce{nbPJ > 1 ? "s" : ""} jointe
                  {nbPJ > 1 ? "s" : ""} de l&apos;original
                </label>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground">
                  Ajouter des pièces jointes
                </p>
                <AttachmentPicker
                  value={forwardAttachments}
                  onChange={setForwardAttachments}
                  disabled={pending}
                  pathPrefix="email-attachments/transfert"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button type="button" variant="hero" onClick={handleForward} disabled={pending}>
                  <Forward aria-hidden="true" />
                  {pending ? "Envoi…" : "Transférer"}
                  {linkedForXp && (
                    <XpPill xp={XP_RULES.email} variant="solid" className="text-shadow-none" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={closeForward}
                  disabled={pending}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-extrabold tracking-[-0.02em] text-foreground">
                  {editingDraftId ? "Brouillon de réponse" : `Répondre à ${replyName}`}
                </h3>
                {linkedForXp && <XpPill xp={XP_RULES.email} label="à l'envoi" />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-9 text-xs font-bold text-muted-foreground">À</span>
                <span className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full bg-info-50 py-1 pr-3 pl-1 text-[13px] font-bold text-info-700">
                  <span
                    aria-hidden="true"
                    className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-extrabold"
                  >
                    {initialsFrom(replyName)}
                  </span>
                  <span className="truncate">{replyRecipient}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowReplyCc((v) => !v)}
                  aria-expanded={showReplyCc}
                  className="ml-auto inline-flex h-8 items-center rounded-[10px] bg-navy-50 px-2.5 text-xs font-bold text-navy-600 hover:bg-navy-100"
                >
                  {showReplyCc ? "Masquer Cc / Cci" : "+ Cc / Cci"}
                </button>
              </div>
              {showReplyCc && (
                <CcBccFields
                  cc={replyCc}
                  bcc={replyBcc}
                  onCc={setReplyCc}
                  onBcc={setReplyBcc}
                  disabled={pending}
                  idPrefix={`reply-${thread.threadId}`}
                />
              )}
              <RichTextEditor
                key={replyKey}
                initialHtml={replyInitial}
                onChange={setReplyHtml}
                disabled={pending}
                placeholder={`Écris ta réponse à ${replyName}…`}
                minHeightClass="min-h-[140px]"
                ariaLabel="Réponse"
                variables={linkedForXp ? MAIL_VARIABLES : undefined}
                footer={<SignaturePreview html={sigHtml} />}
              />
              <AttachmentPicker
                value={replyAttachments}
                onChange={setReplyAttachments}
                disabled={pending}
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button type="button" variant="hero" onClick={handleSend} disabled={pending}>
                  <Send aria-hidden="true" />
                  {pending ? "Envoi…" : "Envoyer la réponse"}
                  {linkedForXp && (
                    <XpPill xp={XP_RULES.email} variant="solid" className="text-shadow-none" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleSaveReplyDraft}
                  disabled={pending}
                >
                  <Save aria-hidden="true" />
                  Enregistrer en brouillon
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={resetReply}
                  disabled={pending}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Bouton-icône d'action du fil (aria-label + infobulle native). */
function IconAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  className,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-[12px] border border-border bg-card text-foreground transition-colors hover:bg-navy-50 disabled:opacity-50",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

/** Étapes de suivi du dernier mail envoyé (statuts réels du webhook Resend). */
function SendTracking({ msg, replied }: { msg: InboxEmail; replied: boolean }) {
  const rank = STATUT_RANK[msg.statut] ?? 0;
  const failed = msg.statut === "REBOND" || msg.statut === "ERREUR";
  const steps: { key: string; label: string; when?: string }[] = [];
  if (msg.statut === "BROUILLON") {
    steps.push({ key: "dry", label: "Enregistré (dry-run)" });
  } else {
    steps.push({
      key: "ENVOYE",
      label: "Envoyé",
      when: msg.envoyeLe ? mailDateTime(msg.envoyeLe) : undefined,
    });
    if (!failed && rank >= 2) steps.push({ key: "LIVRE", label: "Livré" });
    if (!failed && rank >= 3) steps.push({ key: "OUVERT", label: "Ouvert" });
    if (!failed && rank >= 4) steps.push({ key: "CLIQUE", label: "Cliqué" });
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn(CAPS_CLASS, "mr-1")}>Suivi de ton dernier mail</span>
      {steps.map((s) => (
        <StatusPill key={s.key} tone={STATUT_TONE[s.key] ?? "navy"}>
          {s.label}
          {s.when && <span className="font-medium"> · {s.when}</span>}
        </StatusPill>
      ))}
      {failed && (
        <StatusPill tone="red">
          {STATUT_LABEL[msg.statut]} : vérifie l&apos;adresse
        </StatusPill>
      )}
      {replied && (
        <span className="inline-flex h-6 items-center rounded-full bg-lvl-700 px-2.5 text-xs font-extrabold text-white">
          Le contact a répondu !
        </span>
      )}
    </div>
  );
}

/** Barre d'actions affichée en tête d'un thread ouvert depuis le dossier Spam. */
function SpamActionsBar({
  thread,
  onRefresh,
}: {
  thread: { threadId: string; msgs: InboxEmail[] };
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const handleNotSpam = () => {
    startTransition(async () => {
      const res = await markThreadsNotSpam([thread.threadId]);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(notSpamMessage(res.moved ?? 0, res.rulesDisabled ?? []));
      onRefresh();
    });
  };

  const handlePurge = () => {
    if (!confirm("Supprimer définitivement cette conversation ? Irréversible."))
      return;
    startTransition(async () => {
      for (const m of thread.msgs) {
        const res = await purgeEmail(m.id);
        if (!res.ok) {
          toast.error(uiText(res.error, "Échec de la suppression définitive."));
          return;
        }
      }
      toast.success("Conversation supprimée définitivement.");
      onRefresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-gold-50 px-3.5 py-3">
      <p className="min-w-0 flex-[1_1_240px] text-[13px] leading-snug font-semibold text-gold-700">
        Filtré comme spam. Si c&apos;est une erreur, remets-le dans la boîte de
        réception : le filtre correspondant sera désactivé.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleNotSpam}
          disabled={pending}
          className="bg-win-50 text-win-700 shadow-none hover:bg-win-50 hover:brightness-95"
        >
          <ShieldCheck aria-hidden="true" />
          Pas un spam
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handlePurge}
          disabled={pending}
          className="border-alert-500 text-alert-700 hover:bg-alert-50 hover:text-alert-700"
        >
          <Trash2 aria-hidden="true" />
          Supprimer définitivement
        </Button>
      </div>
    </div>
  );
}

/** Barre d'actions affichée en tête d'un thread ouvert depuis la Corbeille. */
function TrashActionsBar({
  thread,
  onRefresh,
}: {
  thread: { threadId: string; msgs: InboxEmail[] };
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const handleRestore = () => {
    startTransition(async () => {
      const res = await restoreThreadsBulk([thread.threadId]);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de la restauration."));
        return;
      }
      toast.success("Conversation restaurée.");
      onRefresh();
    });
  };

  const handlePurge = () => {
    if (
      !confirm(
        "Supprimer définitivement cette conversation ? Cette action est irréversible.",
      )
    )
      return;
    startTransition(async () => {
      // Purge message par message (chaque email déjà à la corbeille).
      for (const m of thread.msgs) {
        const res = await purgeEmail(m.id);
        if (!res.ok) {
          toast.error(uiText(res.error, "Échec de la suppression définitive."));
          return;
        }
      }
      toast.success("Conversation supprimée définitivement.");
      onRefresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-ground px-3.5 py-3">
      <p className="min-w-0 flex-[1_1_200px] text-[13px] font-semibold text-muted-foreground">
        Cette conversation est à la corbeille.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleRestore}
          disabled={pending}
          className="bg-win-50 text-win-700 shadow-none hover:bg-win-50 hover:brightness-95"
        >
          <RotateCcw aria-hidden="true" />
          Restaurer
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handlePurge}
          disabled={pending}
          className="border-alert-500 text-alert-700 hover:bg-alert-50 hover:text-alert-700"
        >
          <Trash2 aria-hidden="true" />
          Supprimer définitivement
        </Button>
      </div>
    </div>
  );
}

/** Bouton-icône d'une bulle de message (aria-label + infobulle native). */
function BubbleAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  className,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-navy-100 hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function MessageBubble({
  message,
  isMine,
  inTrash = false,
  inSpam = false,
  inArchive = false,
  onRefresh,
}: {
  message: InboxEmail;
  isMine: boolean;
  inTrash?: boolean;
  /** Dossier Spam : « restaurer » = « Pas un spam » (désactive le filtre). */
  inSpam?: boolean;
  /** Dossier Archivés : « archiver » devient « remettre dans la boîte ». */
  inArchive?: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();

  const handleRefetch = () => {
    startTransition(async () => {
      const res = await refetchEmailBody(message.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de la récupération."));
        return;
      }
      toast.success("Contenu récupéré.");
      onRefresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Mettre ce message à la corbeille ?")) return;
    startTransition(async () => {
      const res = await deleteEmail(message.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success("Message mis à la corbeille.");
      onRefresh();
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      if (inSpam) {
        const res = await markThreadsNotSpam([message.threadId]);
        if (!res.ok) {
          toast.error(uiText(res.error, "Échec."));
          return;
        }
        toast.success(notSpamMessage(res.moved ?? 0, res.rulesDisabled ?? []));
        onRefresh();
        return;
      }
      const res = await restoreEmail(message.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success("Message restauré.");
      onRefresh();
    });
  };

  const handlePurge = () => {
    if (!confirm("Supprimer définitivement ce message ? Irréversible.")) return;
    startTransition(async () => {
      const res = await purgeEmail(message.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success("Message supprimé définitivement.");
      onRefresh();
    });
  };

  const handleArchive = () => {
    const msg = message.prospect
      ? `Archiver ce message ? Il sera retiré de la boîte de réception mais restera visible sur la fiche de ${message.prospect.raisonSociale}.`
      : "Archiver ce message ? Il sera retiré de la boîte de réception (toujours en DB).";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await setEmailArchive(message.id, true);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success("Message archivé.");
      onRefresh();
    });
  };

  const handleUnarchive = () => {
    startTransition(async () => {
      const res = await setEmailArchive(message.id, false);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success("Message remis dans la boîte.");
      onRefresh();
    });
  };

  const handleSpam = () => {
    if (
      !confirm(
        `Signaler « ${message.expediteurEmail} » comme spam ?\n\nCe message et tous ceux de cet expéditeur vont dans le dossier Spam, et les futurs y seront filtrés automatiquement. Récupérable à tout moment via « Pas un spam ».`,
      )
    )
      return;
    startTransition(async () => {
      const res = await markEmailAsSpam(message.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(
        `Expéditeur bloqué : ${res.moved ?? 0} message(s) déplacé(s) dans Spam.`,
      );
      onRefresh();
    });
  };

  // Un mail entrant, hors corbeille, non rattaché à un client → blocable.
  const canBlock =
    !inTrash && message.direction === "ENTRANT" && !message.prospect;

  const name =
    message.direction === "ENTRANT"
      ? message.expediteurNom || message.expediteurEmail
      : (message.user?.name ?? message.expediteurNom ?? message.expediteurEmail);
  const addr =
    message.direction === "ENTRANT"
      ? message.expediteurNom
        ? `<${message.expediteurEmail}>`
        : ""
      : `à ${message.destinataireEmail}`;
  const statusTone = STATUT_TONE[message.statut] ?? "navy";
  return (
    <article
      className={cn(
        "flex w-full max-w-full flex-col gap-2.5 border p-3.5 sm:max-w-[94%] sm:p-4",
        isMine
          ? "self-end rounded-[16px_16px_4px_16px] border-navy-100 bg-navy-50"
          : message.direction === "ENTRANT"
            ? "self-start rounded-[16px_16px_16px_4px] border-border bg-card"
            : "self-end rounded-[16px_16px_4px_16px] border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold",
            isMine
              ? "bg-coral-400 text-navy-700"
              : message.direction === "ENTRANT" && message.prospect
                ? cn(
                    TONE_CLASSES[message.prospect.statutTone ?? "blue"].bg,
                    TONE_CLASSES[message.prospect.statutTone ?? "blue"].text,
                  )
                : "bg-navy-100 text-navy-700",
          )}
        >
          {initialsFrom(name)}
        </span>
        <div className="min-w-0 flex-[1_1_160px]">
          <p className="text-[13px] font-extrabold break-words text-foreground">
            {name}{" "}
            {addr && (
              <span className="text-xs font-medium break-all text-muted-foreground">{addr}</span>
            )}
          </p>
          <p className="mt-px text-xs text-muted-foreground">
            {mailDateTime(message.envoyeLe ?? message.createdAt)}
          </p>
        </div>
        <StatusPill tone={statusTone}>{STATUT_LABEL[message.statut] ?? message.statut}</StatusPill>
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Mailbox privée : tout mail visible appartient à l'user connecté.
              Dans la corbeille → restaurer / purger ; sinon → archiver /
              mettre à la corbeille. */}
          {inTrash ? (
            <>
              <BubbleAction
                disabled={pending}
                label={inSpam ? "Pas un spam (remettre en boîte de réception)" : "Restaurer le message"}
                icon={inSpam ? ShieldCheck : RotateCcw}
                onClick={handleRestore}
                className="hover:bg-win-50 hover:text-win-700"
              />
              <BubbleAction
                disabled={pending}
                label="Supprimer définitivement"
                icon={Trash2}
                onClick={handlePurge}
                className="hover:bg-alert-50 hover:text-alert-700"
              />
            </>
          ) : (
            <>
              {canBlock && (
                <BubbleAction
                  disabled={pending}
                  label={`Bloquer l'expéditeur (spam) : ${message.expediteurEmail}`}
                  icon={ShieldBan}
                  onClick={handleSpam}
                  className="hover:bg-gold-50 hover:text-gold-700"
                />
              )}
              {inArchive ? (
                <BubbleAction
                  disabled={pending}
                  label="Remettre ce message dans la boîte"
                  icon={ArchiveRestore}
                  onClick={handleUnarchive}
                />
              ) : (
                <BubbleAction
                  disabled={pending}
                  label={
                    message.prospect
                      ? `Archiver (reste sur la fiche ${message.prospect.raisonSociale})`
                      : "Archiver"
                  }
                  icon={Archive}
                  onClick={handleArchive}
                />
              )}
              <BubbleAction
                disabled={pending}
                label="Mettre à la corbeille"
                icon={Trash2}
                onClick={handleDelete}
                className="hover:bg-alert-50 hover:text-alert-700"
              />
            </>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex h-8 items-center gap-1 rounded-[10px] px-2 text-xs font-bold text-info-700 transition-colors hover:bg-info-50"
          >
            {expanded ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
            {expanded ? "Réduire" : "Développer"}
          </button>
        </div>
      </div>
      {!expanded && (
        <p className="truncate text-[13px] text-muted-foreground">
          {message.contenuTexte.replace(/\s+/g, " ").slice(0, 140)}
        </p>
      )}
      {expanded && (
        <div className="flex flex-col gap-3">
          {/* HTML rendu en iframe sandboxée si dispo, sinon texte */}
          {message.contenuHtml ? (
            <EmailHtmlFrame
              html={message.contenuHtml}
              title={message.objet}
              className="w-full rounded-[12px] border border-border bg-white"
            />
          ) : message.contenuTexte ? (
            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {message.contenuTexte}
            </pre>
          ) : message.direction === "ENTRANT" ? (
            <div className="rounded-[12px] bg-gold-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-gold-700">
                Le contenu n&apos;a pas pu être récupéré à la réception (API
                Resend momentanément indisponible). Le message existe toujours
                côté Resend.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefetch}
                disabled={pending}
                className="mt-2"
              >
                <Download aria-hidden="true" />
                {pending ? "Récupération…" : "Récupérer le contenu"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              (Contenu vide : le mail reçu n&apos;avait pas de corps)
            </p>
          )}
          {message.direction === "ENTRANT" &&
            /<img\b[^>]*\bsrc\s*=\s*["'](?!\s*(?:https?:|data:))/i.test(
              message.contenuHtml,
            ) &&
            !message.attachments.some((a) => a.mimeType.startsWith("image/")) && (
              <div className="rounded-[12px] bg-gold-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-gold-700">
                  Une image de ce mail n&apos;a pas pu être chargée à la
                  réception.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefetch}
                  disabled={pending}
                  className="mt-2"
                >
                  <Download aria-hidden="true" />
                  {pending ? "Récupération…" : "Récupérer l'image"}
                </Button>
              </div>
            )}
          {message.attachments.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={CAPS_CLASS}>
                  {message.attachments.length} pièce
                  {message.attachments.length > 1 ? "s" : ""} jointe
                  {message.attachments.length > 1 ? "s" : ""}
                </p>
                {message.attachments.length > 1 && (
                  <a
                    href={`/api/emails/${message.id}/attachments/zip`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-xs font-bold text-info-700 transition-colors hover:bg-info-50"
                    title="Télécharger toutes les pièces jointes dans un .zip"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    Tout télécharger (.zip)
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((a) => {
                  const AttIcon = a.mimeType.startsWith("image/")
                    ? ImageIcon
                    : a.mimeType === "application/pdf"
                      ? FileText
                      : FileIcon;
                  return (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-[12px] border border-border-strong bg-card px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-navy-50"
                      title={`${a.mimeType} · ${formatFileSize(a.taille)}`}
                    >
                      <AttIcon className="size-4 shrink-0 text-mail-700" aria-hidden="true" />
                      <span className="max-w-[200px] truncate font-bold">{a.nom}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(a.taille)}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ===========================================================================
// Rattachement à un client / à une collaboratrice
// ===========================================================================

/**
 * Bouton "Attribuer à un client" qui ouvre un popover avec recherche.
 * - Si déjà attribué : affiche "Changer" et permet de détacher
 * - Sinon : affiche "Attribuer à un client" (ou « Rattacher à un client »
 *   en variante principale, dans la carte « Lead à capter »)
 */
function AttachProspectButton({
  emailId,
  currentProspectId,
  prefillEmail,
  prefillName,
  variant = "subtle",
  onDone,
}: {
  emailId: string;
  currentProspectId: string | null;
  /** Email de l'autre partie : pré-remplit la fiche si on crée le client. */
  prefillEmail?: string | null;
  /** Nom de l'expéditeur : proposé comme raison sociale par défaut. */
  prefillName?: string | null;
  /** `primary` : bouton navy plein (carte « Lead à capter »). */
  variant?: "subtle" | "primary";
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ id: string; raisonSociale: string; ville: string | null; email: string | null }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();

  // Recherche debounced
  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    void searchProspectsForAttach(q).then((r) => {
      setResults(r);
      setSearching(false);
    });
  };

  const handleAttach = (prospectId: string | null) => {
    startTransition(async () => {
      const res = await attachEmailToProspect(emailId, prospectId);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(
        prospectId === null
          ? "Email détaché du client."
          : currentProspectId
            ? "Email attribué au client."
            : "Lead capté : email attribué au client.",
      );
      setOpen(false);
      setQuery("");
      setResults([]);
      onDone();
      router.refresh();
    });
  };

  // Crée une nouvelle entreprise avec la raison sociale tapée (+ email de
  // l'expéditeur pré-rempli), puis attribue immédiatement l'email à ce client.
  const handleCreate = () => {
    const raisonSociale = query.trim();
    if (raisonSociale.length < 2) {
      toast.error("Tape au moins 2 caractères pour le nom du client.");
      return;
    }
    startTransition(async () => {
      const created = await createProspectQuick({
        raisonSociale,
        email: prefillEmail ?? undefined,
      });
      if (!created.ok || !created.prospectId) {
        toast.error(uiText(created.error, "Échec de la création du client."));
        return;
      }
      const res = await attachEmailToProspect(emailId, created.prospectId);
      if (!res.ok) {
        toast.error(
          "Client créé, mais l'attribution de l'email a échoué : " +
            uiText(res.error),
        );
        return;
      }
      toast.success(`Client « ${raisonSociale} » créé et email attribué.`);
      setOpen(false);
      setQuery("");
      setResults([]);
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            // À l'ouverture, propose le nom de l'expéditeur comme point de
            // départ (recherche + éventuelle création).
            if (next && !query && prefillName) handleSearch(prefillName);
            return next;
          });
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[12px] font-bold transition-colors",
          variant === "primary"
            ? "h-10 bg-navy-700 px-3.5 text-[13px] text-white hover:bg-navy-600"
            : "h-9 px-2.5 text-[13px] text-muted-foreground hover:bg-navy-50 hover:text-foreground",
        )}
      >
        <UserPlus className="size-4" aria-hidden="true" />
        {currentProspectId
          ? "Changer"
          : variant === "primary"
            ? "Rattacher ou créer le client"
            : "Attribuer à un client"}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-80 max-w-[calc(100vw-2.5rem)] rounded-[16px] border border-border bg-popover p-3 shadow-arena-lg">
          <label htmlFor={`attach-search-${emailId}`} className="sr-only">
            Rechercher un client
          </label>
          <input
            id={`attach-search-${emailId}`}
            type="search"
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher un client (nom, ville, email)…"
            className={cn(FIELD_CLASS, "h-10")}
            disabled={pending}
          />
          <div className="mt-2 max-h-64 overflow-y-auto">
            {searching && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Recherche…
              </p>
            )}
            {!searching && query && results.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Aucun client trouvé.
              </p>
            )}
            {/* Création d'un nouveau client avec la raison sociale tapée */}
            {!searching && query.trim().length >= 2 && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={pending}
                className="mb-1 flex w-full items-center gap-2 rounded-[12px] border border-dashed border-coral-400 bg-coral-50 px-2.5 py-2 text-left text-xs text-coral-600 transition-colors hover:brightness-95 disabled:opacity-50"
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  Créer le client «&nbsp;<strong>{query.trim()}</strong>&nbsp;»
                  {prefillEmail ? (
                    <span className="block text-[11px] text-muted-foreground">
                      avec l&apos;email {prefillEmail}
                    </span>
                  ) : null}
                </span>
              </button>
            )}
            {!searching &&
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAttach(p.id)}
                  disabled={pending || p.id === currentProspectId}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left text-xs transition-colors hover:bg-navy-50 disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-info-50 text-[10px] font-extrabold text-info-700"
                  >
                    {initialsFrom(p.raisonSociale)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-foreground">{p.raisonSociale}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {p.ville ?? ""}
                      {p.ville && p.email ? " · " : ""}
                      {p.email ?? ""}
                    </span>
                  </span>
                </button>
              ))}
          </div>
          {currentProspectId && (
            <div className="mt-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => handleAttach(null)}
                disabled={pending}
                className="w-full rounded-[10px] px-2 py-1.5 text-xs font-bold text-alert-700 hover:bg-alert-50 disabled:opacity-50"
              >
                Détacher du client actuel
              </button>
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[8px] px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-navy-50 hover:text-foreground"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Bouton "Archiver sous une collaboratrice" (admin) : lie le mail à une
 * collaboratrice pour garder la trace des échanges, sans changer la boîte
 * propriétaire ni le client. Miroir simplifié de AttachProspectButton.
 */
function AttachCollaborateurButton({
  emailId,
  currentCollaborateurId,
}: {
  emailId: string;
  currentCollaborateurId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSearch = (q: string) => {
    setQuery(q);
    setSearching(true);
    void searchCollaborateursForAttach(q).then((r) => {
      setResults(r);
      setSearching(false);
    });
  };

  const handleAttach = (collaborateurId: string | null) => {
    startTransition(async () => {
      const res = await attachEmailToCollaborateur(emailId, collaborateurId);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(
        collaborateurId === null
          ? "Email détaché de la collaboratrice."
          : "Email archivé sous la collaboratrice.",
      );
      setOpen(false);
      setQuery("");
      setResults([]);
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            // À l'ouverture, charge la liste complète des collaboratrices actives.
            if (next && results.length === 0) handleSearch("");
            return next;
          });
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground"
      >
        <UserPlus className="size-3.5" aria-hidden="true" />
        {currentCollaborateurId ? "Changer" : "Attribuer à une collaboratrice"}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-72 max-w-[calc(100vw-2.5rem)] rounded-[16px] border border-border bg-popover p-3 shadow-arena-lg">
          <label htmlFor={`collab-search-${emailId}`} className="sr-only">
            Rechercher une collaboratrice
          </label>
          <input
            id={`collab-search-${emailId}`}
            type="search"
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher une collaboratrice (nom, email)…"
            className={cn(FIELD_CLASS, "h-10")}
            disabled={pending}
          />
          <div className="mt-2 max-h-60 overflow-y-auto">
            {searching && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Recherche…
              </p>
            )}
            {!searching && results.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Aucune collaboratrice trouvée.
              </p>
            )}
            {!searching &&
              results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleAttach(u.id)}
                  disabled={pending || u.id === currentCollaborateurId}
                  className="block w-full rounded-[10px] px-2 py-1.5 text-left text-xs transition-colors hover:bg-navy-50 disabled:opacity-50"
                >
                  <p className="truncate font-bold text-foreground">{u.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {u.email}
                  </p>
                </button>
              ))}
          </div>
          {currentCollaborateurId && (
            <div className="mt-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => handleAttach(null)}
                disabled={pending}
                className="w-full rounded-[10px] px-2 py-1.5 text-xs font-bold text-alert-700 hover:bg-alert-50 disabled:opacity-50"
              >
                Détacher de la collaboratrice
              </button>
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[8px] px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-navy-50 hover:text-foreground"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
