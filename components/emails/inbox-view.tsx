"use client";

/**
 * Vraie boîte de réception emails : sidebar (dossiers) + liste threads + lecture.
 *
 * - Sidebar : Tous / Reçus / Envoyés / Brouillons (avec compteurs)
 * - Liste : threads regroupés par threadId, dernier email en haut
 * - Détail : timeline du thread (tous les messages chronologiquement)
 * - Bouton "Répondre" : modal qui appelle replyToEmail()
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteEmail,
  markThreadRead,
  replyToEmail,
} from "@/app/(app)/emails/actions";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  prospect: { id: string; raisonSociale: string } | null;
  user: { name: string } | null;
}

interface InboxViewProps {
  emails: InboxEmail[];
  isAdmin: boolean;
  /** Email courant de l'user (pour identifier "soi-même") */
  currentUserEmail: string;
}

type FolderType = "all" | "inbox" | "sent" | "draft";

export function InboxView({ emails, isAdmin, currentUserEmail }: InboxViewProps) {
  const [folder, setFolder] = useState<FolderType>("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Regroupe les emails par thread, garde le dernier en haut
  const threads = useMemo(() => {
    const map = new Map<string, InboxEmail[]>();
    for (const e of emails) {
      if (!map.has(e.threadId)) map.set(e.threadId, []);
      map.get(e.threadId)!.push(e);
    }
    // Trie chaque thread par date asc (le 1er message en haut)
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.envoyeLe ?? a.createdAt).getTime() -
          new Date(b.envoyeLe ?? b.createdAt).getTime(),
      );
    }
    // Liste de threads triés par dernier message desc
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
  }, [emails]);

  // Filtre par dossier
  const filteredThreads = useMemo(() => {
    let t = threads;
    if (folder === "inbox") {
      t = t.filter((th) => th.msgs.some((m) => m.direction === "ENTRANT"));
    } else if (folder === "sent") {
      t = t.filter((th) => th.msgs.some((m) => m.direction === "SORTANT" && m.statut !== "BROUILLON"));
    } else if (folder === "draft") {
      t = t.filter((th) => th.msgs.some((m) => m.statut === "BROUILLON"));
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
  }, [threads, folder, search]);

  const counts = useMemo(
    () => ({
      all: threads.length,
      inbox: threads.filter((t) => t.msgs.some((m) => m.direction === "ENTRANT")).length,
      sent: threads.filter((t) => t.msgs.some((m) => m.direction === "SORTANT" && m.statut !== "BROUILLON")).length,
      draft: threads.filter((t) => t.msgs.some((m) => m.statut === "BROUILLON")).length,
    }),
    [threads],
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
        <ul className="max-h-[calc(100vh-280px)] divide-y divide-border overflow-y-auto lg:max-h-[calc(100vh-220px)]">
          {filteredThreads.length === 0 ? (
            <li className="p-8 text-center text-xs text-muted-foreground">
              Aucun email dans ce dossier.
            </li>
          ) : (
            filteredThreads.map((t) => (
              <ThreadListItem
                key={t.threadId}
                thread={t}
                isSelected={selectedThreadId === t.threadId}
                onSelect={() => handleSelectThread(t.threadId)}
                currentUserEmail={currentUserEmail}
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
  onSelect,
  currentUserEmail,
}: {
  thread: { threadId: string; msgs: InboxEmail[]; last: InboxEmail; first: InboxEmail };
  isSelected: boolean;
  onSelect: () => void;
  currentUserEmail: string;
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
      className={`cursor-pointer px-3 py-3 transition-colors ${
        isSelected ? "bg-primary/5" : "hover:bg-muted/50"
      }`}
    >
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
    </li>
  );
}

function ThreadDetail({
  thread,
  currentUserEmail,
  isAdmin,
}: {
  thread: { threadId: string; msgs: InboxEmail[]; last: InboxEmail };
  currentUserEmail: string;
  isAdmin: boolean;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSend = () => {
    if (!replyContent.trim()) {
      toast.error("Écris un contenu.");
      return;
    }
    startTransition(async () => {
      const res = await replyToEmail(thread.last.id, replyContent.trim());
      if (!res.ok) {
        toast.error(res.error ?? "Échec d'envoi.");
        return;
      }
      toast.success(res.dryRun ? "Réponse enregistrée (dry-run)." : "Réponse envoyée ✓");
      setReplyContent("");
      setShowReply(false);
      router.refresh();
    });
  };

  return (
    <div className="flex h-[calc(100vh-280px)] flex-col lg:h-[calc(100vh-220px)]">
      {/* Header thread */}
      <div className="border-b border-border bg-muted/30 p-4">
        <h2 className="text-base font-semibold">{thread.msgs[0]!.objet}</h2>
        {thread.last.prospect && (
          <p className="mt-1 text-xs text-muted-foreground">
            Client :{" "}
            <Link
              href={`/prospects/${thread.last.prospect.id}`}
              className="text-primary hover:underline"
            >
              {thread.last.prospect.raisonSociale}
            </Link>
          </p>
        )}
      </div>

      {/* Timeline messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {thread.msgs.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isMine={
              m.direction === "SORTANT" &&
              m.expediteurEmail.toLowerCase() === currentUserEmail.toLowerCase()
            }
            isAdmin={isAdmin}
            onRefresh={() => router.refresh()}
          />
        ))}
      </div>

      {/* Zone de réponse */}
      <div className="border-t border-border bg-card p-3">
        {!showReply ? (
          <Button
            type="button"
            onClick={() => setShowReply(true)}
            className="w-full"
            variant="outline"
          >
            <Icon name="MailPlus" className="mr-2 h-3.5 w-3.5" />
            Répondre
          </Button>
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
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={6}
              placeholder="Tape ta réponse…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowReply(false);
                  setReplyContent("");
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
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  isAdmin,
  onRefresh,
}: {
  message: InboxEmail;
  isMine: boolean;
  isAdmin: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("Supprimer ce message ?")) return;
    startTransition(async () => {
      const res = await deleteEmail(message.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Message supprimé.");
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
          {(isAdmin || isMine) && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              title="Supprimer"
            >
              <Icon name="Trash2" className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-2 border-t border-border/50 pt-2">
          {/* HTML rendu en iframe sandboxée si dispo, sinon texte */}
          {message.contenuHtml ? (
            <iframe
              srcDoc={message.contenuHtml}
              sandbox=""
              className="h-64 w-full rounded border border-border bg-white"
              title={message.objet}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-xs">
              {message.contenuTexte}
            </pre>
          )}
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
