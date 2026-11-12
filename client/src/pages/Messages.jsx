import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Store } from "lucide-react";
import Header from "../components/Header";
import Composer from "../components/messages/Composer";
import ShirtAttachment from "../components/messages/ShirtAttachment";
import { Badge, EmptyState, ErrorState, Skeleton, Spinner } from "../components/ui/feedback";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage, isCancel } from "../lib/api";
import {
  formatMessageTime,
  INBOX_POLL_MS,
  initials,
  messagesApi,
  previewText,
  refreshUnread,
  THREAD_POLL_MS,
  usePolling,
} from "../lib/messages";
import { cn } from "../lib/utils";

const Avatar = ({ name, className }) => (
  <span
    className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-brand font-display text-sm text-white", className)}
    aria-hidden="true"
  >
    {initials(name)}
  </span>
);

// ------------------------------------------------------------------ Liste des conversations

const ConversationList = ({ conversations, activeId, loading, error, onRetry, user }) => {
  if (error) return <ErrorState description={error} onRetry={onRetry} className="m-4" />;
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }
  if (!conversations.length) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Aucune conversation"
        description={
          user?.role === "designer"
            ? "Vos clients pourront vous écrire depuis la page de vos créations."
            : "Écrivez à un designer depuis sa page ou depuis un t-shirt de la boutique."
        }
        action={
          user?.role !== "designer" && (
            <Button asChild>
              <Link to="/designers">Voir les designers</Link>
            </Button>
          )
        }
        className="px-4 py-10"
      />
    );
  }
  return (
    <ul aria-label="Conversations" className="divide-y divide-border">
      {conversations.map((c) => {
        const active = String(c.id) === String(activeId);
        return (
          <li key={c.id}>
            <Link
              to={`/messages/${c.id}`}
              aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted", active && "bg-brand-soft")}
            >
              <Avatar name={c.other.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.other.name}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatMessageTime(c.last_message?.created_at ?? c.updated_at, { short: true })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-xs", c.unread ? "text-foreground" : "text-muted-foreground")}>{previewText(c.last_message)}</p>
                  {c.unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
                      <span className="sr-only">Non lus : </span>
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

// ------------------------------------------------------------------ Discussion

const Bubble = ({ message }) => {
  const mine = message.mine;
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] space-y-1.5 sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "space-y-2 rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
            mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-muted text-foreground"
          )}
        >
          {message.shirt && <ShirtAttachment shirt={message.shirt} inverted={mine} />}
          {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        </div>
        <p className={cn("px-1 text-[11px] text-muted-foreground", mine && "text-right")}>
          <span className="sr-only">{mine ? "Vous, " : `${message.author_name}, `}</span>
          {formatMessageTime(message.created_at)}
        </p>
      </div>
    </li>
  );
};

const Thread = ({ conversationId, user, onActivity }) => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("loading");
  const [attachment, setAttachment] = useState(null);
  const [myShirts, setMyShirts] = useState([]);
  const listRef = useRef(null);
  const lastIdRef = useRef(0);
  const stickToBottom = useRef(true);

  const append = useCallback((fresh) => {
    if (!fresh.length) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const next = [...prev, ...fresh.filter((m) => !known.has(m.id))];
      lastIdRef.current = next.length ? next[next.length - 1].id : 0;
      return next;
    });
  }, []);

  const markRead = useCallback(async () => {
    try {
      const { read } = await messagesApi.read(conversationId);
      if (read) {
        refreshUnread();
        onActivity?.();
      }
    } catch {
      /* sans gravité : réessayé au prochain message */
    }
  }, [conversationId, onActivity]);

  // Chargement initial.
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setMessages([]);
    lastIdRef.current = 0;
    stickToBottom.current = true;
    Promise.all([messagesApi.get(conversationId, controller.signal), messagesApi.messages(conversationId, null, controller.signal)])
      .then(([conv, list]) => {
        setConversation(conv);
        append(list);
        setStatus("ready");
        if (conv.unread) markRead();
      })
      .catch((err) => {
        if (isCancel(err)) return;
        setStatus(err?.response?.status === 404 ? "notfound" : "error");
      });
    return () => controller.abort();
  }, [conversationId, append, markRead]);

  // Design joint passé dans l'adresse (« Contacter » depuis un t-shirt) : ?shirt=<id>.
  const shirtParam = searchParams.get("shirt");
  useEffect(() => {
    if (!shirtParam) return;
    const controller = new AbortController();
    api
      .get(`/shirts/${shirtParam}/`, { signal: controller.signal })
      .then(({ data }) => setAttachment(data))
      .catch(() => {})
      .finally(() => setSearchParams((p) => {
        p.delete("shirt");
        return p;
      }, { replace: true }));
    return () => controller.abort();
  }, [shirtParam, setSearchParams]);

  // Un designer peut joindre une de ses créations.
  useEffect(() => {
    if (user?.role !== "designer") return;
    const controller = new AbortController();
    api
      .get("/shirts/", { params: { mine: 1 }, signal: controller.signal })
      .then(({ data }) => setMyShirts(data))
      .catch(() => {});
    return () => controller.abort();
  }, [user?.role]);

  // Nouveaux messages : interrogation régulière (onglet visible uniquement).
  usePolling(
    async () => {
      try {
        const fresh = await messagesApi.messages(conversationId, lastIdRef.current || null);
        if (!fresh.length) return;
        append(fresh);
        // Lu d'abord, puis la liste se recharge (sinon elle afficherait encore « 1 non lu »).
        if (fresh.some((m) => !m.mine)) await markRead();
        onActivity?.();
      } catch {
        /* réseau momentané : prochain essai dans quelques secondes */
      }
    },
    THREAD_POLL_MS,
    status === "ready"
  );

  // Défilement : on reste en bas si on y était (on ne fait pas sauter la lecture d'anciens messages).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async ({ body, shirt }) => {
    try {
      const message = await messagesApi.send(conversationId, { body, ...(shirt ? { shirt } : {}) });
      stickToBottom.current = true;
      append([message]);
      onActivity?.();
    } catch (err) {
      toast({ title: "Message non envoyé", description: getErrorMessage(err, "Réessayez dans un instant."), variant: "error" });
      throw err;
    }
  };

  if (status === "notfound") {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Conversation introuvable"
        description="Elle n'existe pas ou ne vous concerne pas."
        action={
          <Button asChild variant="outline">
            <Link to="/messages">Mes conversations</Link>
          </Button>
        }
        className="m-auto"
      />
    );
  }
  if (status === "error") return <ErrorState description="Impossible de charger la conversation." onRetry={() => window.location.reload()} className="m-auto" />;
  if (status === "loading" || !conversation) {
    return (
      <div className="m-auto">
        <Spinner />
      </div>
    );
  }

  const other = conversation.other;
  return (
    <section aria-label={`Conversation avec ${other.name}`} className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button asChild variant="ghost" size="icon" className="lg:hidden">
          <Link to="/messages" aria-label="Retour aux conversations">
            <ArrowLeft />
          </Link>
        </Button>
        <Avatar name={other.name} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">{other.name}</h2>
          <p className="text-xs text-muted-foreground">{other.is_designer ? "Designer" : "Client"}</p>
        </div>
        {other.is_designer && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/ecommerce?designer=${other.id}`}>
              <Store /> <span className="hidden sm:inline">Ses créations</span>
            </Link>
          </Button>
        )}
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Démarrez la conversation : présentez votre projet, joignez un design, demandez un devis…
          </p>
        ) : (
          <ol role="log" aria-live="polite" aria-label="Messages" className="space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
          </ol>
        )}
      </div>

      <Composer
        onSend={send}
        attachment={attachment}
        onAttachmentChange={setAttachment}
        attachable={myShirts}
        placeholder={`Écrire à ${other.name}…`}
        autoFocus
      />
    </section>
  );
};

// ------------------------------------------------------------------ Page

/** Messagerie : liste des conversations + discussion (une colonne à la fois sur mobile). */
const Messages = () => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    try {
      setConversations(await messagesApi.list());
      setError("");
    } catch (err) {
      if (!isCancel(err)) setError(getErrorMessage(err, "Impossible de charger vos conversations."));
    } finally {
      setLoading(false);
    }
  }, []);
  usePolling(loadList, INBOX_POLL_MS);

  const unreadTotal = conversations.reduce((n, c) => n + c.unread, 0);

  return (
    <div className="flex h-dvh flex-col bg-muted/40">
      <Header />
      <main className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col px-0 pb-0 pt-[72px] sm:px-4 sm:pb-4 sm:pt-[88px] md:px-8">
        <div className="flex min-h-0 flex-1 overflow-hidden border-border bg-background sm:rounded-[var(--radius-card)] sm:border sm:shadow-[var(--shadow-card)]">
          <aside
            aria-label="Mes conversations"
            className={cn("min-h-0 w-full flex-col border-r border-border lg:flex lg:w-[340px] lg:shrink-0", conversationId ? "hidden" : "flex")}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h1 className="font-display text-2xl">Messages</h1>
              {unreadTotal > 0 && <Badge tone="brand">{unreadTotal} non lu{unreadTotal > 1 ? "s" : ""}</Badge>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ConversationList
                conversations={conversations}
                activeId={conversationId}
                loading={loading}
                error={error}
                onRetry={loadList}
                user={user}
              />
            </div>
          </aside>
          <div className={cn("min-h-0 flex-1 flex-col", conversationId ? "flex" : "hidden lg:flex")}>
            {conversationId ? (
              <Thread key={conversationId} conversationId={conversationId} user={user} onActivity={loadList} />
            ) : (
              <EmptyState
                icon={MessageCircle}
                title="Choisissez une conversation"
                description="Sélectionnez une conversation dans la liste pour lire et répondre."
                className="m-auto"
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;
