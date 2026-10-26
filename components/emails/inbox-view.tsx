"use client";

/**
 * Vraie boîte de réception emails : sidebar (dossiers) + liste threads + lecture.
 *
 * - Sidebar (à la Gmail) : Boîte de réception / Messages envoyés / Brouillons /
 *   Tous les messages, puis Spam et Corbeille (dossiers distincts).
 * - Liste : threads regroupés par threadId, dernier email en haut
 * - Détail : timeline du thread (tous les messages chronologiquement)
 * - Répondre / Transférer, brouillon de réponse enregistrable dans le fil
 * - Spam : « Pas un spam » (→ boîte de réception + règle désactivée) ;
 *   « Spam » en sélection multiple depuis la boîte.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import {
  AttachmentPicker,
  type PickedAttachment,
} from "@/components/emails/attachment-picker";
import { EmailHtmlFrame } from "@/components/emails/email-html-frame";
import { RichTextEditor } from "@/components/emails/rich-text-editor";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { htmlToPlainText } from "@/lib/email-html";
import { formatFileSize } from "@/lib/format";

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

const STATUT_CLASS: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600",
  ENVOYE: "bg-blue-100 text-blue-700",
  LIVRE: "bg-blue-200 text-blue-800",
  OUVERT: "bg-emerald-100 text-emerald-700",
  CLIQUE: "bg-emerald-200 text-emerald-800",
  REPONDU: "bg-purple-100 text-purple-700",
  REBOND: "bg-red-100 text-red-700",
  ERREUR: "bg-red-100 text-red-700",
};

export interface InboxAttachment {
  id: string;
  nom: string;
  taille: number;
  mimeType: string;
  url: string;
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
  prospect: { id: string; raisonSociale: string } | null;
  collaborateur: { id: string; name: string } | null;
  user: { name: string } | null;
  attachments: InboxAttachment[];
}

/** Vrai brouillon = enregistré volontairement (pas un mail dry-run). */
const isGenuineDraft = (m: InboxEmail) =>
  m.statut === "BROUILLON" && m.labels.includes("draft");

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
  /** Emails à la corbeille (soft-deleted) — dossier « Corbeille ». */
  trashedEmails?: InboxEmail[];
  isAdmin: boolean;
  /** Email courant de l'user (pour identifier "soi-même") */
  currentUserEmail: string;
}

type FolderType = "all" | "inbox" | "sent" | "draft" | "spam" | "trash";

/** Mail filtré par l'anti-spam (vit dans le dossier Spam, pas la Corbeille). */
const isSpam = (m: InboxEmail) => m.labels.includes("spam");

/** Message de confirmation après « Pas un spam ». */
function notSpamMessage(moved: number, rulesDisabled: string[]): string {
  const base = `${moved} message(s) remis dans la boîte de réception`;
  return rulesDisabled.length > 0
    ? `${base} · filtre désactivé : ${rulesDisabled.join(", ")}`
    : base;
}

export function InboxView({
  emails,
  trashedEmails = [],
  isAdmin,
  currentUserEmail,
}: InboxViewProps) {
  const router = useRouter();
  const [bulkPending, startBulk] = useTransition();
  // Comme Gmail : on ouvre sur la boîte de réception.
  const [folder, setFolder] = useState<FolderType>("inbox");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Sélection multiple (par threadId) pour archivage / suppression en masse.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

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
  // propriétaire — la page ne sert QUE les mails du user connecté côté serveur.

  const inTrash = folder === "trash";
  const inSpam = folder === "spam";

  // Regroupe les emails par thread : boîte active, Spam et Corbeille séparés
  // (les mails filtrés portent le label "spam" ; le reste des supprimés = Corbeille).
  const threads = useMemo(() => groupThreads(emails), [emails]);
  const spamThreads = useMemo(
    () => groupThreads(trashedEmails.filter(isSpam)),
    [trashedEmails],
  );
  const trashThreads = useMemo(
    () => groupThreads(trashedEmails.filter((m) => !isSpam(m))),
    [trashedEmails],
  );

  // Filtre par dossier
  const filteredThreads = useMemo(() => {
    let t = inSpam ? spamThreads : inTrash ? trashThreads : threads;
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
          th.last.destinataireEmail.toLowerCase().includes(q) ||
          th.last.prospect?.raisonSociale?.toLowerCase().includes(q) ||
          th.msgs.some((m) => m.contenuTexte.toLowerCase().includes(q)),
      );
    }
    return t;
  }, [threads, spamThreads, trashThreads, inSpam, inTrash, folder, search]);

  const counts = useMemo(
    () => ({
      all: threads.length,
      inbox: threads.filter((t) => t.msgs.some((m) => m.direction === "ENTRANT")).length,
      // Non lus de la boîte de réception (affiché en gras comme Gmail).
      inboxUnread: threads.filter((t) =>
        t.msgs.some((m) => m.direction === "ENTRANT" && !m.lu),
      ).length,
      sent: threads.filter((t) =>
        t.msgs.some((m) => m.direction === "SORTANT" && !isGenuineDraft(m)),
      ).length,
      draft: threads.filter((t) => t.msgs.some(isGenuineDraft)).length,
      spam: spamThreads.length,
      trash: trashThreads.length,
    }),
    [threads, spamThreads, trashThreads],
  );

  const selectedThread = filteredThreads.find((t) => t.threadId === selectedThreadId);

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    // Marque le thread comme lu si au moins 1 message non lu
    const t = threads.find((th) => th.threadId === threadId);
    if (t && t.msgs.some((m) => !m.lu)) {
      void markThreadRead(threadId);
    }
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
        `Archiver ${ids.length} conversation(s) ? Elles quittent la boîte de réception (toujours visibles sur les fiches clients).`,
      )
    )
      return;
    startBulk(async () => {
      const res = await archiveThreadsBulk(ids);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'archivage.");
        return;
      }
      toast.success(`${ids.length} conversation(s) archivée(s).`);
      clearSelection();
      if (selectedThreadId && ids.includes(selectedThreadId))
        setSelectedThreadId(null);
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
        toast.error(res.error ?? "Échec de la suppression.");
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
        toast.error(res.error ?? "Échec de la restauration.");
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
        toast.error(res.error ?? "Échec.");
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
        toast.error(res.error ?? "Échec.");
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
        toast.error(res.error ?? "Échec.");
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
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(`Spam vidé (${res.count ?? 0} email(s) supprimé(s)).`);
      clearSelection();
      setSelectedThreadId(null);
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_320px_1fr]">
      {/* Sidebar */}
      <aside className="space-y-1 lg:sticky lg:top-4 lg:self-start">
        <FolderButton
          label="Boîte de réception"
          icon="Inbox"
          // Comme Gmail : compteur = non lus (gras) ; rien si tout est lu.
          count={counts.inboxUnread}
          emphasize={counts.inboxUnread > 0}
          active={folder === "inbox"}
          onClick={() => {
            setFolder("inbox");
            setSelectedThreadId(null);
          }}
        />
        <FolderButton
          label="Messages envoyés"
          icon="Send"
          count={counts.sent}
          active={folder === "sent"}
          onClick={() => {
            setFolder("sent");
            setSelectedThreadId(null);
          }}
        />
        <FolderButton
          label="Brouillons"
          icon="FileText"
          count={counts.draft}
          emphasize={counts.draft > 0}
          active={folder === "draft"}
          onClick={() => {
            setFolder("draft");
            setSelectedThreadId(null);
          }}
        />
        <FolderButton
          label="Tous les messages"
          icon="Mails"
          count={counts.all}
          active={folder === "all"}
          onClick={() => {
            setFolder("all");
            setSelectedThreadId(null);
          }}
        />
        <div className="my-1 border-t border-border" />
        <FolderButton
          label="Spam"
          icon="ShieldBan"
          count={counts.spam}
          active={folder === "spam"}
          onClick={() => {
            setFolder("spam");
            setSelectedThreadId(null);
          }}
        />
        {inSpam && counts.spam > 0 && (
          <button
            type="button"
            onClick={handleEmptySpam}
            disabled={bulkPending}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Icon name="Trash2" className="h-3 w-3" />
            Vider le spam
          </button>
        )}
        <FolderButton
          label="Corbeille"
          icon="Trash2"
          count={counts.trash}
          active={folder === "trash"}
          onClick={() => {
            setFolder("trash");
            setSelectedThreadId(null);
          }}
        />
        {inTrash && counts.trash > 0 && (
          <button
            type="button"
            onClick={handleEmptyTrash}
            disabled={bulkPending}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Icon name="Trash2" className="h-3 w-3" />
            Vider la corbeille
          </button>
        )}
      </aside>

      {/* Liste threads */}
      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (objet, contact, contenu)…"
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
          />
        </div>

        {/* Barre de sélection multiple */}
        {visibleCheckedIds.length > 0 ? (
          <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-3 py-2">
            <span className="text-xs font-medium">
              {visibleCheckedIds.length} sélectionné
              {visibleCheckedIds.length > 1 ? "s" : ""}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {inSpam ? (
                <button
                  type="button"
                  onClick={handleBulkNotSpam}
                  disabled={bulkPending}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                  title="Remettre dans la boîte de réception et désactiver le filtre"
                >
                  <Icon name="ShieldCheck" className="h-3 w-3" />
                  Pas un spam
                </button>
              ) : inTrash ? (
                <button
                  type="button"
                  onClick={handleBulkRestore}
                  disabled={bulkPending}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                  title="Restaurer la sélection"
                >
                  <Icon name="RotateCcw" className="h-3 w-3" />
                  Restaurer
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleBulkSpam}
                    disabled={bulkPending}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50"
                    title="Signaler comme spam (bloque les expéditeurs)"
                  >
                    <Icon name="ShieldBan" className="h-3 w-3" />
                    Spam
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkArchive}
                    disabled={bulkPending}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                    title="Archiver la sélection"
                  >
                    <Icon name="Inbox" className="h-3 w-3" />
                    Archiver
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkPending}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    title="Mettre la sélection à la corbeille"
                  >
                    <Icon name="Trash2" className="h-3 w-3" />
                    Corbeille
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={clearSelection}
                disabled={bulkPending}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
                title="Annuler la sélection"
              >
                <Icon name="X" className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : (
          filteredThreads.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/40">
              <input
                type="checkbox"
                checked={allVisibleChecked}
                onChange={toggleAllVisible}
                className="h-3.5 w-3.5 cursor-pointer"
              />
              Tout sélectionner
            </label>
          )
        )}

        <ul className="max-h-[calc(100vh-280px)] divide-y divide-border overflow-y-auto lg:max-h-[calc(100vh-220px)]">
          {filteredThreads.length === 0 ? (
            <li className="p-8 text-center text-xs text-muted-foreground">
              {inSpam
                ? "Aucun spam. 🎉"
                : inTrash
                  ? "La corbeille est vide."
                  : folder === "draft"
                    ? "Aucun brouillon."
                    : "Aucun email dans ce dossier."}
            </li>
          ) : (
            filteredThreads.map((t) => (
              <ThreadListItem
                key={t.threadId}
                thread={t}
                isSelected={selectedThreadId === t.threadId}
                isChecked={checkedIds.has(t.threadId)}
                onToggleCheck={() => toggleChecked(t.threadId)}
                onSelect={() => handleSelectThread(t.threadId)}
              />
            ))
          )}
        </ul>
      </section>

      {/* Lecture du thread sélectionné */}
      <section className="rounded-lg border border-border bg-card">
        {selectedThread ? (
          <ThreadDetail
            key={selectedThread.threadId}
            thread={selectedThread}
            currentUserEmail={currentUserEmail}
            isAdmin={isAdmin}
            inTrash={inTrash}
            inSpam={inSpam}
          />
        ) : (
          <div className="flex h-[calc(100vh-280px)] items-center justify-center text-center lg:h-[calc(100vh-220px)]">
            <div>
              <Icon name="Mail" className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Sélectionne un email pour le lire.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FolderButton({
  label,
  icon,
  count,
  active,
  emphasize = false,
  onClick,
}: {
  label: string;
  icon: string;
  count: number;
  active: boolean;
  /** Gras (non lus / brouillons en attente), comme dans Gmail. */
  emphasize?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-full px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted"
      } ${emphasize ? "font-semibold" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon name={icon} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {count > 0 && (
        <span
          className={`text-[11px] tabular-nums ${
            active ? "opacity-80" : emphasize ? "" : "text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ThreadListItem({
  thread,
  isSelected,
  isChecked,
  onToggleCheck,
  onSelect,
}: {
  thread: { threadId: string; msgs: InboxEmail[]; last: InboxEmail; first: InboxEmail };
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
  const hasUnread = thread.msgs.some((m) => !m.lu);
  return (
    <li
      onClick={onSelect}
      className={`flex cursor-pointer gap-2 px-3 py-3 transition-colors ${
        isSelected ? "bg-primary/5" : isChecked ? "bg-primary/[0.03]" : "hover:bg-muted/50"
      }`}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggleCheck}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer"
        aria-label="Sélectionner la conversation"
      />
      <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        {hasUnread && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
            aria-label="Non lu"
          />
        )}
        <Icon
          name={last.direction === "ENTRANT" ? "MailOpen" : "MailPlus"}
          className="h-3 w-3 shrink-0 text-muted-foreground"
        />
        <span
          className={`truncate text-xs ${hasUnread ? "font-bold" : "font-medium"}`}
        >
          {otherParty}
        </span>
        {thread.msgs.length > 1 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {thread.msgs.length}
          </span>
        )}
        {/* Comme Gmail : « Brouillon » en rouge si un brouillon attend dans le fil. */}
        {thread.msgs.some(isGenuineDraft) && (
          <span className="shrink-0 text-[10px] font-semibold text-red-600">
            Brouillon
          </span>
        )}
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {formatShortDate(last.envoyeLe ?? last.createdAt)}
        </span>
      </div>
      <p
        className={`mt-1 truncate text-sm ${hasUnread ? "font-bold" : "font-medium"}`}
      >
        {last.objet}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {last.contenuTexte.slice(0, 100)}
      </p>
      {thread.last.prospect && (
        <p className="mt-1 truncate text-[10px] text-muted-foreground">
          → {thread.last.prospect.raisonSociale}
        </p>
      )}
      </div>
    </li>
  );
}

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

  // Destinataire figé (stocké dans le brouillon) — client lié ou adresse libre.
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
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Brouillon mis à jour ✓");
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
        toast.error(saved.error ?? "Échec de l'enregistrement.");
        return;
      }
      const res = await sendDraft(draft.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'envoi.");
        return;
      }
      toast.success(res.dryRun ? "Brouillon (dry-run, pas d'envoi réel)." : "Brouillon envoyé ✓");
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Supprimer ce brouillon ?")) return;
    startTransition(async () => {
      const res = await deleteEmail(draft.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Brouillon supprimé.");
      router.refresh();
    });
  };

  return (
    <div className="flex h-[calc(100vh-280px)] flex-col lg:h-[calc(100vh-220px)]">
      <div className="border-b border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-slate-100 text-slate-600">Brouillon</Badge>
          <h2 className="text-base font-semibold">
            {objet.trim() || "(sans objet)"}
          </h2>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Destinataire :{" "}
          <strong>
            {draft.prospect
              ? draft.prospect.raisonSociale
              : draft.destinataireEmail || "—"}
          </strong>
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {!showCc ? (
          <button
            type="button"
            onClick={() => setShowCc(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            + Cc / Cci
          </button>
        ) : (
          <div className="space-y-1.5">
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Cc : copie@exemple.ch, autre@exemple.ch"
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="Cci : copie.cachee@exemple.ch"
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Sujet
          </label>
          <input
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            placeholder="Sujet du message"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Message
          </label>
          <RichTextEditor
            initialHtml={draft.contenuHtml}
            onChange={setContenuHtml}
            disabled={pending}
            placeholder="Écris ton message…"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Pièces jointes
          </label>
          <AttachmentPicker
            value={attachments}
            onChange={setAttachments}
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-card p-3">
        <Button
          type="button"
          variant="ghost"
          onClick={handleDelete}
          disabled={pending}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Icon name="Trash2" className="mr-1.5 h-3.5 w-3.5" />
          Supprimer
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={pending}
          >
            <Icon name="Save" className="mr-1.5 h-3.5 w-3.5" />
            Enregistrer
          </Button>
          <Button type="button" onClick={handleSendNow} disabled={pending}>
            <Icon name="MailPlus" className="mr-1.5 h-3.5 w-3.5" />
            {pending ? "…" : "Envoyer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThreadDetail({
  thread,
  currentUserEmail,
  isAdmin,
  inTrash = false,
  inSpam = false,
}: {
  thread: { threadId: string; msgs: InboxEmail[]; last: InboxEmail };
  currentUserEmail: string;
  isAdmin: boolean;
  inTrash?: boolean;
  inSpam?: boolean;
}) {
  const [showReply, setShowReply] = useState(false);
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
  // Transfert — panneau distinct de la réponse (destinataire libre).
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

  // Un thread d'un seul message qui est un vrai brouillon → éditeur dédié
  // (terminer / modifier / envoyer plus tard). Pas dans la corbeille ni le spam.
  const draftMsg =
    !inTrash &&
    !inSpam &&
    thread.msgs.length === 1 &&
    isGenuineDraft(thread.msgs[0]!)
      ? thread.msgs[0]!
      : null;

  // Brouillon de RÉPONSE dans un fil existant : affiché à part (bandeau
  // « Reprendre »), pas comme un message de la conversation.
  const replyDraft =
    !inTrash && !inSpam && thread.msgs.length > 1
      ? (thread.msgs.find(isGenuineDraft) ?? null)
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
  const replyObjet = (() => {
    const base = thread.msgs[0]!.objet.trim();
    return /^re\s*:/i.test(base) ? base : `Re: ${base}`;
  })();

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
    setReplyHtml("");
    setReplyInitial("");
    setEditingDraftId(null);
    setReplyKey((k) => k + 1);
    setShowReply(true);
  };

  /** Reprend le brouillon de réponse dans l'éditeur (contenu, PJ, Cc/Cci). */
  const resumeReplyDraft = () => {
    if (!replyDraft) return;
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
  };

  const openForward = () => {
    setForwardHtml("");
    setForwardKey((k) => k + 1);
    setForwardAttachments([]);
    setShowForward(true);
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
        toast.error(res.error ?? "Échec de l'enregistrement.");
        return;
      }
      toast.success("Brouillon enregistré — retrouve-le dans « Brouillons » ✓");
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
        toast.error(res.error ?? "Échec.");
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
      if (editingDraftId) {
        // Brouillon repris : on enregistre les dernières modifs puis on l'envoie
        // (il reste dans le fil, In-Reply-To conservé).
        const saved = await saveReplyDraft();
        if (!saved.ok) {
          toast.error(saved.error ?? "Échec de l'enregistrement.");
          return;
        }
        res = await sendDraft(editingDraftId);
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
        toast.error(res.error ?? "Échec d'envoi.");
        return;
      }
      toast.success(res.dryRun ? "Réponse enregistrée (dry-run)." : "Réponse envoyée ✓");
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
        toast.error(res.error ?? "Échec du transfert.");
        return;
      }
      toast.success(
        res.dryRun ? "Transfert enregistré (dry-run)." : "Message transféré ✓",
      );
      closeForward();
      router.refresh();
    });
  };

  // Pièces jointes de l'original — pour proposer (ou non) de les réexpédier.
  const nbPJ = lastReal.attachments?.length ?? 0;

  return (
    <div className="flex h-[calc(100vh-280px)] flex-col lg:h-[calc(100vh-220px)]">
      {/* Header thread */}
      <div className="border-b border-border bg-muted/30 p-4">
        <h2 className="text-base font-semibold">{thread.msgs[0]!.objet}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Client :</span>
          {thread.last.prospect ? (
            <Link
              href={`/prospects/${thread.last.prospect.id}`}
              className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/20"
            >
              {thread.last.prospect.raisonSociale}
            </Link>
          ) : (
            <span className="text-muted-foreground italic">Non attribué</span>
          )}
          <AttachProspectButton
            emailId={thread.last.id}
            currentProspectId={thread.last.prospect?.id ?? null}
            prefillEmail={
              thread.last.direction === "ENTRANT"
                ? thread.last.expediteurEmail
                : thread.last.destinataireEmail
            }
            prefillName={
              thread.last.direction === "ENTRANT"
                ? thread.last.expediteurNom ?? null
                : null
            }
            onDone={() => {
              /* le router.refresh() est dans le composant */
            }}
          />
        </div>
        {/* Archivage sous une collaboratrice — réservé à l'admin (trace des
            échanges, ex. recrutement). N'affecte pas la boîte ni le client. */}
        {isAdmin && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Collaboratrice :</span>
            {thread.last.collaborateur ? (
              <Link
                href={`/rh/${thread.last.collaborateur.id}`}
                className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/20"
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
      </div>

      {/* Timeline messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {visibleMsgs.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isMine={
              m.direction === "SORTANT" &&
              m.expediteurEmail.toLowerCase() === currentUserEmail.toLowerCase()
            }
            isAdmin={isAdmin}
            inTrash={inTrash || inSpam}
            inSpam={inSpam}
            onRefresh={() => router.refresh()}
          />
        ))}
      </div>

      {/* Zone de réponse — remplacée par les actions Spam / Corbeille si on y est */}
      {inSpam ? (
        <SpamActionsBar thread={thread} onRefresh={() => router.refresh()} />
      ) : inTrash ? (
        <TrashActionsBar thread={thread} onRefresh={() => router.refresh()} />
      ) : (
      <div className="border-t border-border bg-card p-3">
        {!showReply && !showForward ? (
          <div className="space-y-2">
            {replyDraft && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span className="min-w-0 truncate">
                  <strong>Brouillon de réponse</strong> enregistré le{" "}
                  {formatFullDate(replyDraft.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={handleDeleteReplyDraft}
                  disabled={pending}
                  className="shrink-0 rounded px-1.5 py-0.5 text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={replyDraft ? resumeReplyDraft : openReply}
              className="flex-1"
              variant="outline"
            >
              <Icon
                name={replyDraft ? "Pencil" : "MailPlus"}
                className="mr-2 h-3.5 w-3.5"
              />
              {replyDraft ? "Reprendre le brouillon" : "Répondre"}
            </Button>
            <Button
              type="button"
              onClick={openForward}
              className="flex-1"
              variant="outline"
            >
              <Icon name="Forward" className="mr-2 h-3.5 w-3.5" />
              Transférer
            </Button>
          </div>
          </div>
        ) : showForward ? (
          <div className="space-y-2">
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">
                Transférer à
              </span>
              <input
                type="email"
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
                placeholder="adresse@exemple.ch"
                disabled={pending}
                autoFocus
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              />
            </label>

            {!showForwardCc ? (
              <button
                type="button"
                onClick={() => setShowForwardCc(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Cc / Cci
              </button>
            ) : (
              <div className="space-y-1.5">
                <input
                  value={forwardCc}
                  onChange={(e) => setForwardCc(e.target.value)}
                  placeholder="Cc : copie@exemple.ch, autre@exemple.ch"
                  disabled={pending}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                />
                <input
                  value={forwardBcc}
                  onChange={(e) => setForwardBcc(e.target.value)}
                  placeholder="Cci : copie.cachee@exemple.ch"
                  disabled={pending}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                />
              </div>
            )}

            <RichTextEditor
              key={forwardKey}
              onChange={setForwardHtml}
              disabled={pending}
              placeholder="Ajoute un mot (facultatif)…"
              minHeightClass="min-h-[90px]"
            />

            {sigHtml && (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Signature (ajoutée automatiquement)
                </p>
                <div dangerouslySetInnerHTML={{ __html: sigHtml }} />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Le message d&apos;origine est cité automatiquement en dessous.
            </p>

            {nbPJ > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={forwardPJ}
                  onChange={(e) => setForwardPJ(e.target.checked)}
                  disabled={pending}
                  className="h-3.5 w-3.5 cursor-pointer"
                />
                Joindre les {nbPJ} pièce{nbPJ > 1 ? "s" : ""} jointe
                {nbPJ > 1 ? "s" : ""} de l&apos;original
              </label>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Ajouter des pièces jointes
              </p>
              <AttachmentPicker
                value={forwardAttachments}
                onChange={setForwardAttachments}
                disabled={pending}
                pathPrefix="email-attachments/transfert"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeForward}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button type="button" onClick={handleForward} disabled={pending}>
                {pending ? "Envoi…" : "Transférer"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {editingDraftId ? "Brouillon de réponse à " : "Répondre à "}
              <strong>{replyRecipient}</strong>
            </p>
            {!showReplyCc ? (
              <button
                type="button"
                onClick={() => setShowReplyCc(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Cc / Cci
              </button>
            ) : (
              <div className="space-y-1.5">
                <input
                  value={replyCc}
                  onChange={(e) => setReplyCc(e.target.value)}
                  placeholder="Cc : copie@exemple.ch, autre@exemple.ch"
                  disabled={pending}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                />
                <input
                  value={replyBcc}
                  onChange={(e) => setReplyBcc(e.target.value)}
                  placeholder="Cci : copie.cachee@exemple.ch"
                  disabled={pending}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                />
              </div>
            )}
            <RichTextEditor
              key={replyKey}
              initialHtml={replyInitial}
              onChange={setReplyHtml}
              disabled={pending}
              placeholder="Tape ta réponse…"
              minHeightClass="min-h-[120px]"
            />
            {sigHtml && (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Signature (ajoutée automatiquement)
                </p>
                <div dangerouslySetInnerHTML={{ __html: sigHtml }} />
              </div>
            )}
            <AttachmentPicker
              value={replyAttachments}
              onChange={setReplyAttachments}
              disabled={pending}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={resetReply}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveReplyDraft}
                disabled={pending}
              >
                <Icon name="Save" className="mr-1.5 h-3.5 w-3.5" />
                Enregistrer en brouillon
              </Button>
              <Button type="button" onClick={handleSend} disabled={pending}>
                {pending ? "Envoi…" : "Envoyer la réponse"}
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

/** Barre d'actions affichée sous un thread ouvert depuis le dossier Spam. */
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
        toast.error(res.error ?? "Échec.");
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
          toast.error(res.error ?? "Échec de la suppression définitive.");
          return;
        }
      }
      toast.success("Conversation supprimée définitivement.");
      onRefresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-orange-50/60 p-3">
      <p className="text-xs text-orange-900">
        Filtré comme spam. Si c&apos;est une erreur, remets-le dans la boîte de
        réception : le filtre correspondant sera désactivé.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={handleNotSpam} disabled={pending}>
          <Icon name="ShieldCheck" className="mr-1.5 h-3.5 w-3.5" />
          Pas un spam
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handlePurge}
          disabled={pending}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Icon name="Trash2" className="mr-1.5 h-3.5 w-3.5" />
          Supprimer définitivement
        </Button>
      </div>
    </div>
  );
}

/** Barre d'actions affichée sous un thread ouvert depuis la Corbeille. */
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
        toast.error(res.error ?? "Échec de la restauration.");
        return;
      }
      toast.success("Conversation restaurée ✓");
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
          toast.error(res.error ?? "Échec de la suppression définitive.");
          return;
        }
      }
      toast.success("Conversation supprimée définitivement.");
      onRefresh();
    });
  };

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">
        Cette conversation est à la corbeille.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleRestore}
          disabled={pending}
        >
          <Icon name="RotateCcw" className="mr-1.5 h-3.5 w-3.5" />
          Restaurer
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handlePurge}
          disabled={pending}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Icon name="Trash2" className="mr-1.5 h-3.5 w-3.5" />
          Supprimer définitivement
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  isAdmin,
  inTrash = false,
  inSpam = false,
  onRefresh,
}: {
  message: InboxEmail;
  isMine: boolean;
  isAdmin: boolean;
  inTrash?: boolean;
  /** Dossier Spam : « restaurer » = « Pas un spam » (désactive le filtre). */
  inSpam?: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();

  const handleRefetch = () => {
    startTransition(async () => {
      const res = await refetchEmailBody(message.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la récupération.");
        return;
      }
      toast.success("Contenu récupéré ✓");
      onRefresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Mettre ce message à la corbeille ?")) return;
    startTransition(async () => {
      const res = await deleteEmail(message.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
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
          toast.error(res.error ?? "Échec.");
          return;
        }
        toast.success(notSpamMessage(res.moved ?? 0, res.rulesDisabled ?? []));
        onRefresh();
        return;
      }
      const res = await restoreEmail(message.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Message restauré ✓");
      onRefresh();
    });
  };

  const handlePurge = () => {
    if (!confirm("Supprimer définitivement ce message ? Irréversible.")) return;
    startTransition(async () => {
      const res = await purgeEmail(message.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
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
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Message archivé.");
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
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        `Expéditeur bloqué — ${res.moved ?? 0} message(s) déplacé(s) dans Spam.`,
      );
      onRefresh();
    });
  };

  // Un mail entrant, hors corbeille, non rattaché à un client → blocable.
  const canBlock =
    !inTrash && message.direction === "ENTRANT" && !message.prospect;

  return (
    <div
      className={`rounded-lg border p-3 ${
        isMine
          ? "border-primary/30 bg-primary/5 ml-8"
          : message.direction === "ENTRANT"
            ? "border-blue-200 bg-blue-50/30 mr-8"
            : "border-border bg-background"
      }`}
    >
      <div className="flex items-start justify-between gap-2 text-xs">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {message.direction === "ENTRANT"
              ? `${message.expediteurNom || ""} <${message.expediteurEmail}>`
              : `→ ${message.destinataireEmail}`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {message.user?.name ? `${message.user.name} · ` : ""}
            {formatFullDate(message.envoyeLe ?? message.createdAt)}
            {" · "}
            <Badge
              variant="secondary"
              className={`font-normal ${STATUT_CLASS[message.statut] ?? ""}`}
            >
              {STATUT_LABEL[message.statut] ?? message.statut}
            </Badge>
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md p-1 hover:bg-muted"
            title={expanded ? "Réduire" : "Développer"}
          >
            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} className="h-3 w-3" />
          </button>
          {/* Mailbox privée : tout mail visible appartient à l'user connecté.
              Dans la corbeille → restaurer / purger ; sinon → archiver /
              mettre à la corbeille. */}
          {inTrash ? (
            <>
              <button
                type="button"
                onClick={handleRestore}
                disabled={pending}
                className="rounded-md p-1 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                title={
                  inSpam
                    ? "Pas un spam (remettre en boîte de réception)"
                    : "Restaurer le message"
                }
              >
                <Icon
                  name={inSpam ? "ShieldCheck" : "RotateCcw"}
                  className="h-3 w-3"
                />
              </button>
              <button
                type="button"
                onClick={handlePurge}
                disabled={pending}
                className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                title="Supprimer définitivement"
              >
                <Icon name="Trash2" className="h-3 w-3" />
              </button>
            </>
          ) : (
            <>
              {canBlock && (
                <button
                  type="button"
                  onClick={handleSpam}
                  disabled={pending}
                  className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  title={`Bloquer l'expéditeur (spam) — ${message.expediteurEmail}`}
                >
                  <Icon name="ShieldBan" className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={handleArchive}
                disabled={pending}
                className="rounded-md p-1 text-muted-foreground hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                title={
                  message.prospect
                    ? `Archiver (reste sur la fiche ${message.prospect.raisonSociale})`
                    : "Archiver"
                }
              >
                <Icon name="Inbox" className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                title="Mettre à la corbeille"
              >
                <Icon name="Trash2" className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-2 border-t border-border/50 pt-2">
          {/* HTML rendu en iframe sandboxée si dispo, sinon texte */}
          {message.contenuHtml ? (
            <EmailHtmlFrame
              html={message.contenuHtml}
              title={message.objet}
            />
          ) : message.contenuTexte ? (
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {message.contenuTexte}
            </pre>
          ) : message.direction === "ENTRANT" ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">
                Le contenu n&apos;a pas pu être récupéré à la réception (API
                Resend momentanément indisponible). Le message existe toujours
                côté Resend.
              </p>
              <button
                type="button"
                onClick={handleRefetch}
                disabled={pending}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                <Icon name="Download" className="h-3 w-3" />
                {pending ? "Récupération…" : "Récupérer le contenu"}
              </button>
            </div>
          ) : (
            <p className="italic text-xs text-muted-foreground">
              (Contenu vide — le mail reçu n&apos;avait pas de corps)
            </p>
          )}
          {message.direction === "ENTRANT" &&
            /<img\b[^>]*\bsrc\s*=\s*["'](?!\s*(?:https?:|data:))/i.test(
              message.contenuHtml,
            ) &&
            !message.attachments.some((a) => a.mimeType.startsWith("image/")) && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-800">
                  Une image de ce mail n&apos;a pas pu être chargée à la
                  réception.
                </p>
                <button
                  type="button"
                  onClick={handleRefetch}
                  disabled={pending}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  <Icon name="Download" className="h-3 w-3" />
                  {pending ? "Récupération…" : "Récupérer l'image"}
                </button>
              </div>
            )}
          {message.attachments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {message.attachments.length} pièce
                  {message.attachments.length > 1 ? "s" : ""} jointe
                  {message.attachments.length > 1 ? "s" : ""}
                </p>
                {message.attachments.length > 1 && (
                  <a
                    href={`/api/emails/${message.id}/attachments/zip`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                    title="Télécharger toutes les pièces jointes dans un .zip"
                  >
                    <Icon name="Download" className="h-3.5 w-3.5" />
                    Tout télécharger (.zip)
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs hover:bg-muted"
                    title={`${a.mimeType} · ${formatFileSize(a.taille)}`}
                  >
                    <Icon
                      name={
                        a.mimeType.startsWith("image/")
                          ? "Image"
                          : a.mimeType === "application/pdf"
                            ? "FileText"
                            : "Download"
                      }
                      className="h-3 w-3"
                    />
                    <span className="max-w-[200px] truncate">{a.nom}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({formatFileSize(a.taille)})
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Bouton "Attribuer à un client" qui ouvre un popover avec recherche.
 * - Si déjà attribué : affiche "Changer" et permet de détacher
 * - Sinon : affiche "Attribuer à un client"
 */
function AttachProspectButton({
  emailId,
  currentProspectId,
  prefillEmail,
  prefillName,
  onDone,
}: {
  emailId: string;
  currentProspectId: string | null;
  /** Email de l'autre partie — pré-remplit la fiche si on crée le client. */
  prefillEmail?: string | null;
  /** Nom de l'expéditeur — proposé comme raison sociale par défaut. */
  prefillName?: string | null;
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
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        prospectId === null
          ? "Email détaché du client."
          : "Email attribué au client ✓",
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
        toast.error(created.error ?? "Échec de la création du client.");
        return;
      }
      const res = await attachEmailToProspect(emailId, created.prospectId);
      if (!res.ok) {
        toast.error(
          "Client créé, mais l'attribution de l'email a échoué : " +
            (res.error ?? ""),
        );
        return;
      }
      toast.success(`Client « ${raisonSociale} » créé et email attribué ✓`);
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
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            // À l'ouverture, propose le nom de l'expéditeur comme point de
            // départ (recherche + éventuelle création).
            if (next && !query && prefillName) handleSearch(prefillName);
            return next;
          });
        }}
        className="rounded-md border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted"
      >
        <Icon name="UserPlus" className="mr-1 inline h-3 w-3" />
        {currentProspectId ? "Changer" : "Attribuer à un client"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-3 shadow-lg">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher un client (nom, ville, email)…"
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
            disabled={pending}
          />
          <div className="mt-2 max-h-60 overflow-y-auto">
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
                className="mb-1 flex w-full items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5 text-left text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <Icon name="Plus" className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  Créer le client «&nbsp;<strong>{query.trim()}</strong>&nbsp;»
                  {prefillEmail ? (
                    <span className="block text-[10px] text-primary/70">
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
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50"
                >
                  <p className="truncate font-medium">{p.raisonSociale}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {p.ville ?? ""}
                    {p.ville && p.email ? " · " : ""}
                    {p.email ?? ""}
                  </p>
                </button>
              ))}
          </div>
          {currentProspectId && (
            <div className="mt-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => handleAttach(null)}
                disabled={pending}
                className="w-full rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Détacher du client actuel
              </button>
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] text-muted-foreground hover:underline"
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
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        collaborateurId === null
          ? "Email détaché de la collaboratrice."
          : "Email archivé sous la collaboratrice ✓",
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
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            // À l'ouverture, charge la liste complète des collaboratrices actives.
            if (next && results.length === 0) handleSearch("");
            return next;
          });
        }}
        className="rounded-md border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted"
      >
        <Icon name="UserPlus" className="mr-1 inline h-3 w-3" />
        {currentCollaborateurId ? "Changer" : "Attribuer à une collaboratrice"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-3 shadow-lg">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher une collaboratrice (nom, email)…"
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
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
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50"
                >
                  <p className="truncate font-medium">{u.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
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
                className="w-full rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Détacher de la collaboratrice
              </button>
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] text-muted-foreground hover:underline"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatShortDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("fr-CH", { day: "2-digit", month: "short" });
}

function formatFullDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("fr-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
