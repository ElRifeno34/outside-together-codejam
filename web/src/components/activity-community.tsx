import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, LockKeyhole, MessageCircle, RefreshCw, Send, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { useLanguage } from "@/i18n";
import type { ActivityBoardRow } from "@/data/fixtures";
import * as api from "@/api";
import { toast } from "sonner";
import "./activity-community.css";
import { creditsFor } from "@/data/rewards";

export function ActivityCommunity({
  activity,
  joined,
  attendanceSubmitted,
  onJoin,
}: {
  activity: ActivityBoardRow;
  joined: boolean;
  attendanceSubmitted: boolean;
  onJoin: () => void;
}) {
  const { profile, refreshProfile } = useApp();
  const { tr } = useLanguage();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const tasks = useQuery({
    queryKey: ["challenges", activity.id, profile?.id],
    queryFn: () => api.getActivityChallenges(activity.id),
  });
  const people = useQuery({
    queryKey: ["activity-people", activity.id],
    queryFn: () => api.getActivityPeople(activity.id),
  });
  const chat = useQuery({
    queryKey: ["activity-chat", activity.id, profile?.id],
    queryFn: () => api.getActivityChat(activity.id),
    enabled: joined && !!profile,
  });
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [chat.data]);
  const eligible = joined && attendanceSubmitted;
  const ended = Date.now() >= new Date(activity.starts_at).getTime() + 60 * 60000;
  const claim = async (taskId: string) => {
    setClaiming(taskId);
    try {
      await api.completeChallenge(activity.id, taskId);
      toast.success(tr("Task submitted · awaiting creator or admin approval"));
      await refreshProfile();
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setClaiming(null);
    }
  };
  return (
    <div className="activity-community">
      <section aria-label={tr("Bonus challenges")}>
        <div className="community-heading">
          <h2>
            <Sparkles />
            {tr("Bonus challenges")}
          </h2>
        </div>
        <p className="community-caption">
          {tr("A little more curiosity.")}{" "}
          {tr("Optional · rewards after creator or admin approval.")}
        </p>
        {tasks.isPending ? (
          <p className="community-caption">{tr("One moment…")}</p>
        ) : tasks.error ? (
          <p role="alert" className="community-error">
            {tr("Couldn’t load challenges.")}{" "}
            <Button variant="link" onClick={() => void tasks.refetch()}>
              {tr("Try again")}
            </Button>
          </p>
        ) : (
          tasks.data?.map((task) => (
            <article className="challenge-item" key={task.id}>
              <div className="challenge-top">
                <h3>{tr(task.title)}</h3>
                <span className="challenge-reward">
                  +{task.points} {tr("pts")}
                </span>
              </div>
              <p>{tr(task.description)}</p>
              <p>
                +{creditsFor(task.points, activity.niche_value)} {tr("credits earned")}
              </p>
              <div className="challenge-footer">
                <span className="challenge-level">
                  <Sparkles size={13} />
                  {tr("Niche level")} {task.niche}/5
                </span>
                <Button
                  size="sm"
                  variant={task.completed ? "secondary" : "outline"}
                  disabled={
                    !eligible ||
                    task.completed ||
                    task.review_status === "pending" ||
                    claiming !== null
                  }
                  onClick={() => void claim(task.id)}
                >
                  {task.completed ? (
                    <>
                      <Check />
                      {tr("Bonus earned")}
                    </>
                  ) : task.review_status === "pending" ? (
                    tr("Awaiting approval")
                  ) : claiming === task.id ? (
                    tr("One moment…")
                  ) : (
                    <>
                      <Check />
                      {tr(
                        task.review_status === "rejected"
                          ? "Resubmit task"
                          : "Submit task completion",
                      )}
                    </>
                  )}
                </Button>
              </div>
              {task.review_status === "rejected" && (
                <p className="review-reason">
                  {tr("Rejected")}: {task.rejection_reason}
                </p>
              )}
            </article>
          ))
        )}
        {!eligible && (
          <p className="community-caption">
            {tr(joined ? "Submit your attendance first" : "Join to take on the challenges.")}
          </p>
        )}
      </section>
      <section aria-label={tr("Meet the group")}>
        <div className="community-heading">
          <h2>
            <Users />
            {tr("Meet the group")}
          </h2>
          {joined && (
            <Button
              variant="ghost"
              size="icon"
              title={tr("Refresh conversation")}
              aria-label={tr("Refresh conversation")}
              disabled={chat.isFetching}
              onClick={() => void chat.refetch()}
            >
              <RefreshCw />
            </Button>
          )}
        </div>
        <p className="community-caption">{tr("A few new faces. A shared hour outside.")}</p>
        {people.error ? (
          <p role="alert" className="community-error">
            {tr("Couldn’t load the group.")}{" "}
            <Button variant="link" onClick={() => void people.refetch()}>
              {tr("Try again")}
            </Button>
          </p>
        ) : (
          <div className="people-strip">
            {people.data?.map((person) => (
              <details className="person-intro" key={person.id}>
                <summary>
                  <span className="community-avatar">{person.name.charAt(0)}</span>
                  {person.name}
                  {person.id === profile?.id && ` · ${tr("You")}`}
                </summary>
                <p>{tr(person.bio)}</p>
              </details>
            ))}
          </div>
        )}
        <div className="chat-panel">
          <div className="chat-label">
            <LockKeyhole size={13} />
            {tr("Group chat · participants only")}
          </div>
          {!joined ? (
            <div className="chat-gate">
              <MessageCircle size={28} />
              <h3>{tr("Say hello before you go.")}</h3>
              <p>{tr("Join this activity to meet the group and chat.")}</p>
              {!ended && (
                <Button
                  onClick={onJoin}
                  disabled={
                    activity.available_spots === 0 ||
                    activity.status === "cancelled" ||
                    Date.now() >= new Date(activity.starts_at).getTime()
                  }
                >
                  {tr("Join activity")}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div
                className="chat-messages"
                role="log"
                aria-label={tr("Group messages")}
                aria-live="polite"
                ref={list}
              >
                {chat.isPending ? (
                  <p className="community-caption">{tr("Loading conversation…")}</p>
                ) : chat.error ? (
                  <p role="alert" className="community-error">
                    {tr("Couldn’t load the conversation.")}{" "}
                    <Button variant="link" onClick={() => void chat.refetch()}>
                      {tr("Try again")}
                    </Button>
                  </p>
                ) : chat.data?.length ? (
                  chat.data.map((message) => (
                    <div
                      className="chat-message"
                      key={message.id}
                      data-own={message.user_id === profile?.id}
                    >
                      <strong>
                        {message.display_name}
                        {message.user_id === profile?.id && ` · ${tr("You")}`}
                      </strong>
                      <p>{message.seeded ? tr(message.body) : message.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="community-caption">{tr("Be the first to say hello.")}</p>
                )}
              </div>
              <form
                className="chat-composer"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSending(true);
                  setError("");
                  try {
                    await api.sendActivityMessage(activity.id, text);
                    setText("");
                    await chat.refetch();
                  } catch (err) {
                    setError(tr(err instanceof Error ? err.message : "Please try again"));
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <div className="chat-prompts">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setText(tr("Hi! What’s one hidden gem in Montréal you love?"))}
                  >
                    {tr("Break the ice")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setText(tr("Where exactly should we meet?"))}
                  >
                    {tr("Meeting spot?")}
                  </Button>
                </div>
                <div className="chat-input-row">
                  <textarea
                    aria-label={tr("Your message")}
                    placeholder={tr("Say hello to the group…")}
                    maxLength={500}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={sending || activity.status === "cancelled"}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    title={tr("Send message")}
                    aria-label={tr("Send message")}
                    disabled={!text.trim() || sending || activity.status === "cancelled"}
                  >
                    <Send />
                  </Button>
                </div>
                <div className="chat-count">{text.length}/500</div>
                {error && (
                  <p className="community-error" role="alert">
                    {error}
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
