"use client";

/**
 * Vraie boîte de réception emails : sidebar (dossiers) + liste threads + lecture.
 *
 * - Sidebar : Tous / Reçus / Envoyés / Brouillons (avec compteurs)
 * - Liste : threads regroupés par threadId, dernier email en haut
 * - Détail : timeline du thread (tous les messages chronologiquement)
 * - Bouton "Répondre" : modal qui appelle replyToEmail()
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  archiveThread,
  archiveThreadsBulk,
  attachEmailToProspect,
  deleteEmail,
  deleteThreadsBulk,
  emptyTrash,
  forwardEmail,
  markThreadRead,
  purgeEmail,
  replyToEmail,
  restoreEmail,
  restoreThreadsBulk,
  saveEmailDraft,
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
  objet: string;
  contenuHtml: string;
  contenuTexte: string;
  statut: string;
  envoyeLe: string | null;
  createdAt: string;
  lu: boolean;
  labels: string[];
  prospect: { id: string; raisonSociale: string } | null;
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

type FolderType = "all" | "inbox" | "sent" | "draft" | "trash";

export function InboxView({
  emails,
  trashedEmails = [],
  isAdmin,
  currentUserEmail,
}: InboxViewProps) {
  const router = useRouter();
  const [bulkPending, startBulk] = useTransition();
  const [folder, setFolder] = useState<FolderType>("all");
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

  // Regroupe les emails par thread (boîte active + corbeille séparément).
  const threads = useMemo(() => groupThreads(emails), [emails]);
  const trashThreads = useMemo(
    () => groupThreads(trashedEmails),
    [trashedEmails],
  );

  // Filtre par dossier
  const filteredThreads = useMemo(() => {
    let t = inTrash ? trashThreads : threads;
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
  }, [threads, trashThreads, inTrash, folder, search]);

  const counts = useMemo(
    () => ({
      all: threads.length,
      inbox: threads.filter((t) => t.msgs.some((m) => m.direction === "ENTRANT")).length,
      sent: threads.filter((t) =>
        t.msgs.some((m) => m.direction === "SORTANT" && !isGenuineDraft(m)),
      ).length,
      draft: threads.filter((t) => t.msgs.some(isGenuineDraft)).length,
      trash: trashThreads.length,
    }),
    [threads, trashThreads],
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_320px_1fr]">
      {/* Sidebar */}
      <aside className="space-y-1 lg:sticky lg:top-4 lg:self-start">
        <FolderButton
          label="Tous"
          icon="Inbox"
          count={counts.all}
          active={folder === "all"}
          onClick={() => setFolder("all")}
        />
        <FolderButton
          label="Reçus"
          icon="MailOpen"
          count={counts.inbox}
          active={folder === "inbox"}
          onClick={() => setFolder("inbox")}
        />
        <FolderButton
          label="Envoyés"
          icon="MailPlus"
          count={counts.sent}
          active={folder === "sent"}
          onClick={() => setFolder("sent")}
        />
        <FolderButton
          label="Brouillons"
          icon="FileText"
          count={counts.draft}
          active={folder === "draft"}
          onClick={() => setFolder("draft")}
        />
        <div className="my-1 border-t border-border" />
        <FolderButton
          label="Corbeille"
          icon="Trash2"
          count={counts.trash}
          active={folder === "trash"}
          onClick={() => setFolder("trash")}
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
              {inTrash ? (
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
              {inTrash ? "La corbeille est vide." : "Aucun email dans ce dossier."}
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
            thread={selectedThread}
            currentUserEmail={currentUserEmail}
            isAdmin={isAdmin}
            inTrash={inTrash}
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
  onClick,
}: {
  label: string;
  icon: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon name={icon} className="h-3.5 w-3.5" />
        {label}
      </span>
      <span
        className={`text-[10px] tabular-nums ${
          active ? "opacity-80" : "text-muted-foreground"
        }`}
      >
        {count}
      </span>
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

  // Destinataire figé (stocké dans le brouillon) — client lié ou adresse libre.
  const recipientArgs = draft.prospect
    ? { prospectId: draft.prospect.id }
    : { to: draft.destinataireEmail };

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
}: {
  thread: { threadId: string; msgs: InboxEmail[]; last: InboxEmail };
  currentUserEmail: string;
  isAdmin: boolean;
  inTrash?: boolean;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyHtml, setReplyHtml] = useState("");
  const [replyKey, setReplyKey] = useState(0);
  const [replyAttachments, setReplyAttachments] = useState<PickedAttachment[]>([]);
  // Transfert — panneau distinct de la réponse (destinataire libre).
  const [showForward, setShowForward] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardHtml, setForwardHtml] = useState("");
  const [forwardKey, setForwardKey] = useState(0);
  const [forwardPJ, setForwardPJ] = useState(true);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const replyText = htmlToPlainText(replyHtml);

  // Un thread d'un seul message qui est un vrai brouillon → éditeur dédié
  // (terminer / modifier / envoyer plus tard). Pas dans la corbeille.
  const draftMsg =
    !inTrash && thread.msgs.length === 1 && isGenuineDraft(thread.msgs[0]!)
      ? thread.msgs[0]!
      : null;
  if (draftMsg) {
    return <DraftEditor key={draftMsg.id} draft={draftMsg} />;
  }

  const handleSend = () => {
    if (!replyText.trim()) {
      toast.error("Écris un contenu.");
      return;
    }
    startTransition(async () => {
      const res = await replyToEmail(
        thread.last.id,
        replyText.trim(),
        undefined,
        replyAttachments.length > 0 ? replyAttachments : undefined,
        replyHtml,
      );
      if (!res.ok) {
        toast.error(res.error ?? "Échec d'envoi.");
        return;
      }
      toast.success(res.dryRun ? "Réponse enregistrée (dry-run)." : "Réponse envoyée ✓");
      setReplyHtml("");
      setReplyKey((k) => k + 1);
      setReplyAttachments([]);
      setShowReply(false);
      router.refresh();
    });
  };

  const closeForward = () => {
    setShowForward(false);
    setForwardTo("");
    setForwardHtml("");
    setForwardKey((k) => k + 1);
    setForwardPJ(true);
  };

  const handleForward = () => {
    if (!forwardTo.trim()) {
      toast.error("Indique un destinataire.");
      return;
    }
    startTransition(async () => {
      const res = await forwardEmail({
        emailId: thread.last.id,
        to: forwardTo.trim(),
        contenu: htmlToPlainText(forwardHtml).trim(),
        contenuHtml: forwardHtml,
        inclurePiecesJointes: forwardPJ,
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
  const nbPJ = thread.last.attachments?.length ?? 0;

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
      </div>

      {/* Timeline messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {thread.msgs.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isMine={
              m.direction === "SORTANT" &&
              m.expediteurEmail.toLowerCase() === currentUserEmail.toLowerCase()
            }
            isAdmin={isAdmin}
            inTrash={inTrash}
            onRefresh={() => router.refresh()}
          />
        ))}
      </div>

      {/* Zone de réponse — remplacée par les actions corbeille si on y est */}
      {inTrash ? (
        <TrashActionsBar thread={thread} onRefresh={() => router.refresh()} />
      ) : (
      <div className="border-t border-border bg-card p-3">
        {!showReply && !showForward ? (
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setShowReply(true)}
              className="flex-1"
              variant="outline"
            >
              <Icon name="MailPlus" className="mr-2 h-3.5 w-3.5" />
              Répondre
            </Button>
            <Button
              type="button"
              onClick={() => setShowForward(true)}
              className="flex-1"
              variant="outline"
            >
              <Icon name="Forward" className="mr-2 h-3.5 w-3.5" />
              Transférer
            </Button>
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

            <RichTextEditor
              key={forwardKey}
              onChange={setForwardHtml}
              disabled={pending}
              placeholder="Ajoute un mot (facultatif)…"
              minHeightClass="min-h-[90px]"
            />

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
              Répondre à{" "}
              <strong>
                {thread.last.direction === "ENTRANT"
                  ? thread.last.expediteurEmail
                  : thread.last.destinataireEmail}
              </strong>
            </p>
            <RichTextEditor
              key={replyKey}
              onChange={setReplyHtml}
              disabled={pending}
              placeholder="Tape ta réponse…"
              minHeightClass="min-h-[120px]"
            />
            <AttachmentPicker
              value={replyAttachments}
              onChange={setReplyAttachments}
              disabled={pending}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowReply(false);
                  setReplyHtml("");
                  setReplyKey((k) => k + 1);
                  setReplyAttachments([]);
                }}
                disabled={pending}
              >
                Annuler
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
  onRefresh,
}: {
  message: InboxEmail;
  isMine: boolean;
  isAdmin: boolean;
  inTrash?: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();

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
                title="Restaurer le message"
              >
                <Icon name="RotateCcw" className="h-3 w-3" />
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
          ) : (
            <p className="italic text-xs text-muted-foreground">
              (Contenu vide — le mail original n'avait pas de corps)
            </p>
          )}
          {message.attachments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {message.attachments.length} pièce
                {message.attachments.length > 1 ? "s" : ""} jointe
                {message.attachments.length > 1 ? "s" : ""}
              </p>
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
