import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Badge, Card, EmptyState, Skeleton } from "../ui/feedback";
import { formatMessageTime, INBOX_POLL_MS, initials, messagesApi, previewText, usePolling } from "../../lib/messages";
import { cn } from "../../lib/utils";

/** Carte « Messages » des tableaux de bord : 3 dernières conversations, non lus, lien vers la messagerie. */
const RecentConversations = ({ emptyText }) => {
  const [conversations, setConversations] = useState(null);
  const load = useCallback(() => messagesApi.list().then(setConversations).catch(() => setConversations((c) => c ?? [])), []);
  usePolling(load, INBOX_POLL_MS * 3);
  const unread = (conversations ?? []).reduce((n, c) => n + c.unread, 0);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-2xl">Messages</h2>
        {unread > 0 && <Badge tone="brand">{unread} non lu{unread > 1 ? "s" : ""}</Badge>}
      </div>
      {conversations === null ? (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState icon={MessageCircle} title="Aucun message" description={emptyText} className="py-6" />
      ) : (
        <ul className="divide-y divide-border">
          {conversations.slice(0, 3).map((c) => (
            <li key={c.id}>
              <Link to={`/messages/${c.id}`} className="flex items-center gap-3 rounded-[var(--radius-control)] px-1 py-3 hover:bg-muted">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand font-display text-xs text-white" aria-hidden="true">
                  {initials(c.other.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.other.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{previewText(c.last_message)}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                  {formatMessageTime(c.last_message?.created_at ?? c.updated_at, { short: true })}
                  {c.unread > 0 && (
                    <span className="ml-auto mt-1 flex h-5 w-fit min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
                      {c.unread}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="outline" className="mt-4 w-full">
        <Link to="/messages">
          <MessageCircle /> Ouvrir la messagerie
        </Link>
      </Button>
    </Card>
  );
};

export default RecentConversations;
