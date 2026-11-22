import { useLanguage } from "@/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, MessageCircle, UserPlus } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { ChatThread } from "@/components/chat-thread";
import { DisplayName, ProfileAvatar } from "@/components/profile-bits";
import * as api from "@/api";

export const Route = createFileRoute("/messages")({
  validateSearch: z.object({ with: z.string().optional() }),
  head: () => ({ meta: [{ title: "Messages · Outside Together" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { tr, language } = useLanguage();
  const { profile, openAuth } = useApp();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/messages" });
  const client = useQueryClient();
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: api.getConversations,
    enabled: !!profile,
    refetchInterval: 30_000,
    retry: false,
  });

  // A message for me in another thread updates the list (unread counts).
  useEffect(() => {
    if (!profile) return;
    return api.onNewMessage(() => void client.invalidateQueries({ queryKey: ["conversations"] }));
  }, [profile, client]);

  if (!profile)
    return (
      <main className="page-width">
        <div className="empty-state">
          <MessageCircle size={30} />
          <h2>{tr("Chat with your friends")}</h2>
          <p>{tr("Sign in with Google to message your friends.")}</p>
          <Button onClick={() => openAuth()}>{tr("Sign in")}</Button>
        </div>
      </main>
    );

  const list = conversations.data ?? [];
  const active = list.find((c) => c.friend_id === search.with);
  const ago = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
          timeZone: "America/Toronto",
          month: "short",
          day: "numeric",
        }).format(new Date(iso))
      : "";

  return (
    <main className="page-width messages-page" data-open={!!active}>
      <aside className="conversation-list" aria-label={tr("Conversations")}>
        <h1>{tr("Messages")}</h1>
        {conversations.isError ? (
          <p className="chat-empty">
            {tr("Chat isn't set up yet. Run migration 020 in Supabase.")}
          </p>
        ) : list.length === 0 && !conversations.isLoading ? (
          <div className="chat-empty">
            <p>{tr("You can message friends once they accept your request.")}</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/rankings" search={{ tab: "friends" }}>
                <UserPlus /> {tr("Add friends")}
              </Link>
            </Button>
          </div>
        ) : (
          <ul>
            {list.map((c) => (
              <li key={c.friend_id}>
                <button
                  type="button"
                  className="conversation"
                  data-active={c.friend_id === search.with}
                  onClick={() => void navigate({ search: { with: c.friend_id } })}
                >
                  <ProfileAvatar
                    name={c.display_name}
                    avatarItem={c.avatar_item}
                    frameItem={c.frame_item}
                    size={40}
                  />
                  <span className="conversation-text">
                    <DisplayName
                      name={c.display_name}
                      effectItem={c.name_effect_item}
                      as="strong"
                    />
                    <small>
                      {c.last_body
                        ? `${c.last_from_me ? `${tr("You")}: ` : ""}${c.last_body}`
                        : tr("Say hi!")}
                    </small>
                  </span>
                  <span className="conversation-side">
                    <small>{ago(c.last_at)}</small>
                    {c.unread > 0 && <span className="friend-badge">{c.unread}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="conversation-pane">
        {active ? (
          <>
            <header className="conversation-head">
              <Button
                variant="ghost"
                size="icon"
                className="conversation-back"
                aria-label={tr("Back")}
                onClick={() => void navigate({ search: {} })}
              >
                <ArrowLeft />
              </Button>
              <Link to="/u/$id" params={{ id: active.friend_id }} className="conversation-who">
                <ProfileAvatar
                  name={active.display_name}
                  avatarItem={active.avatar_item}
                  frameItem={active.frame_item}
                  size={36}
                />
                <DisplayName
                  name={active.display_name}
                  effectItem={active.name_effect_item}
                  as="strong"
                />
              </Link>
            </header>
            <ChatThread target={{ friendId: active.friend_id }} meId={profile.id} />
          </>
        ) : (
          <div className="chat-empty chat-pick">
            <MessageCircle size={28} />
            <p>{tr("Pick a friend to start chatting.")}</p>
          </div>
        )}
      </section>
    </main>
  );
}
