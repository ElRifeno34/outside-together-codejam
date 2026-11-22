import { useLanguage } from "@/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-bits";
import type { ChatMessage } from "@/lib/types";
import * as api from "@/api";

type Target = { friendId: string } | { activityId: string };

/**
 * A chat thread (1:1 with a friend, or an activity's group chat) with live updates.
 * New messages arrive through Supabase Realtime; a 15 s refresh covers missed events.
 */
export function ChatThread({ target, meId }: { target: Target; meId: string }) {
  const { tr, language } = useLanguage();
  const client = useQueryClient();
  const key = "friendId" in target ? ["dm", target.friendId] : ["activity-chat", target.activityId];
  const messages = useQuery({
    queryKey: key,
    queryFn: () =>
      "friendId" in target
        ? api.getDirectMessages(target.friendId)
        : api.getActivityMessages(target.activityId),
    refetchInterval: 15_000,
  });
  const senders = [...new Set((messages.data ?? []).map((m) => m.sender_id))].sort();
  const people = useQuery({
    queryKey: ["people", senders.join(",")],
    queryFn: () => api.getPeople(senders),
    enabled: senders.length > 0,
  });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const belongs = (m: ChatMessage) =>
    "friendId" in target
      ? (m.sender_id === target.friendId && m.recipient_id === meId) ||
        (m.sender_id === meId && m.recipient_id === target.friendId)
      : m.activity_id === target.activityId;

  // Live: append messages for this thread as they arrive.
  useEffect(
    () =>
      api.onNewMessage((m) => {
        if (!belongs(m)) return;
        client.setQueryData<ChatMessage[]>(key, (old = []) =>
          old.some((x) => x.id === m.id) ? old : [...old, m],
        );
        void client.invalidateQueries({ queryKey: ["conversations"] });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one subscription per thread
    [key.join(":"), meId],
  );

  // Opening a 1:1 thread marks it read.
  const friendId = "friendId" in target ? target.friendId : null;
  const count = messages.data?.length ?? 0;
  useEffect(() => {
    if (!friendId) return;
    void api
      .markChatRead(friendId)
      .then(() => client.invalidateQueries({ queryKey: ["conversations"] }));
  }, [friendId, count, client]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      await api.sendMessage(body, target);
      setText("");
      await messages.refetch();
      void client.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setSending(false);
    }
  };

  const who = (id: string) => people.data?.find((p) => p.id === id);
  const time = (iso: string) =>
    new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
      timeZone: "America/Toronto",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <div className="chat-thread">
      <div className="chat-messages" role="log" aria-live="polite">
        {messages.isError ? (
          <p className="chat-empty">
            {tr("Chat isn't set up yet. Run migration 020 in Supabase.")}
          </p>
        ) : count === 0 && !messages.isLoading ? (
          <p className="chat-empty">{tr("No messages yet. Say hi!")}</p>
        ) : (
          (messages.data ?? []).map((m, i, all) => {
            const mine = m.sender_id === meId;
            const prev = all[i - 1];
            const grouped = prev?.sender_id === m.sender_id;
            const person = who(m.sender_id);
            return (
              <div key={m.id} className="chat-message" data-mine={mine} data-grouped={grouped}>
                {!mine && !grouped && "activityId" in target && (
                  <ProfileAvatar
                    name={person?.display_name ?? "?"}
                    avatarItem={person?.avatar_item}
                    frameItem={person?.frame_item}
                    size={28}
                  />
                )}
                <div className="chat-bubble">
                  {!mine && !grouped && "activityId" in target && (
                    <strong className="chat-sender">{person?.display_name ?? "…"}</strong>
                  )}
                  <p>{m.body}</p>
                  <time dateTime={m.created_at}>{time(m.created_at)}</time>
                </div>
              </div>
            );
          })
        )}
        <div ref={end} />
      </div>
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder={tr("Write a message…")}
          aria-label={tr("Write a message…")}
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !text.trim()}
          aria-label={tr("Send")}
        >
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}
