import { useLanguage } from "@/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Swords } from "lucide-react";
import { toast } from "sonner";
import { questPoints, type ActivityBoardRow } from "@/lib/types";
import * as api from "@/api";

const VALIDATION_HOURS_AFTER_END = 48;

/**
 * Side quests on the activity page. Everyone sees the quests and what they're worth;
 * attendees see which of theirs were validated; the creator (event admin) ticks who
 * completed what, from the start until 48 h after the end.
 */
export function SideQuests({
  activity,
  isCreator,
  signedIn,
}: {
  activity: Pick<ActivityBoardRow, "id" | "niche_value" | "starts_at" | "duration_min">;
  isCreator: boolean;
  signedIn: boolean;
}) {
  const { tr } = useLanguage();
  const quests = useQuery({
    queryKey: ["activity-quests", activity.id],
    queryFn: () => api.getActivityQuests(activity.id),
  });
  const mine = useQuery({
    queryKey: ["my-quest-completions"],
    queryFn: () => api.getMyQuestCompletions(),
    enabled: signedIn && !isCreator,
  });
  const list = quests.data ?? [];
  if (quests.isError || (!list.length && !isCreator)) return null;

  const worth = questPoints(activity.niche_value);
  const done = new Set((mine.data ?? []).map((c) => c.quest_id));
  const start = new Date(activity.starts_at).getTime();
  const end = start + activity.duration_min * 60_000;
  const now = Date.now();
  const window =
    now < start ? "before" : now > end + VALIDATION_HOURS_AFTER_END * 3_600_000 ? "closed" : "open";

  return (
    <section className="side-quests" aria-labelledby="side-quests-title">
      <div className="side-quests-head">
        <h2 id="side-quests-title">
          <Swords size={18} aria-hidden="true" /> {tr("Side quests")}
        </h2>
        <span className="side-quests-worth">
          +{worth} {tr("pts each, validated by the organizer")}
        </span>
      </div>

      {list.length === 0 ? (
        <p className="side-quests-note">
          {tr("No side quests yet. Add some by editing the activity (before it starts).")}
        </p>
      ) : (
        <ul className="side-quest-list">
          {list.map((q) => (
            <li key={q.id} data-done={done.has(q.id)}>
              {done.has(q.id) ? <Check size={16} /> : <Swords size={16} aria-hidden="true" />}
              <span>{tr(q.title)}</span>
              {done.has(q.id) && (
                <em>
                  {tr("Validated")} · +{worth}
                </em>
              )}
            </li>
          ))}
        </ul>
      )}

      {isCreator && list.length > 0 && (
        <div className="quest-admin">
          <h3>{tr("Validate attendees")}</h3>
          {window === "before" ? (
            <p className="side-quests-note">
              {tr("You'll tick who completed each side quest here once the activity starts.")}
            </p>
          ) : (
            <QuestGrid
              activityId={activity.id}
              quests={list}
              worth={worth}
              readOnly={window === "closed"}
            />
          )}
        </div>
      )}
    </section>
  );
}

function QuestGrid({
  activityId,
  quests,
  worth,
  readOnly,
}: {
  activityId: string;
  quests: { id: string; title: string }[];
  worth: number;
  readOnly: boolean;
}) {
  const { tr } = useLanguage();
  const client = useQueryClient();
  const board = useQuery({
    queryKey: ["quest-board", activityId],
    queryFn: () => api.getQuestBoard(activityId),
  });
  const [pending, setPending] = useState<string | null>(null);

  const toggle = async (questId: string, userId: string, name: string, next: boolean) => {
    const key = `${questId}:${userId}`;
    setPending(key);
    try {
      await api.validateQuest(questId, userId, next);
      await board.refetch();
      void client.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(
        next ? `${name} +${worth} ${tr("pts")}` : `${tr("Points taken back from")} ${name}`,
      );
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setPending(null);
    }
  };

  if (board.isLoading) return <p className="side-quests-note">{tr("Loading attendees…")}</p>;
  if (board.isError)
    return <p className="side-quests-note">{tr("Couldn't load attendees. Try again.")}</p>;
  const rows = board.data ?? [];
  if (!rows.length)
    return (
      <p className="side-quests-note">
        {tr("No one else has joined, so there's no one to validate yet.")}
      </p>
    );

  return (
    <div className="quest-grid-wrap">
      {readOnly && (
        <p className="side-quests-note">
          {tr("Validation closed 48 h after the activity. This is the final result.")}
        </p>
      )}
      <table className="quest-grid">
        <thead>
          <tr>
            <th scope="col">{tr("Attendee")}</th>
            {quests.map((q, i) => (
              <th scope="col" key={q.id} title={q.title}>
                <span className="quest-grid-num">{i + 1}</span>
                <span className="quest-grid-title">{tr(q.title)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id}>
              <th scope="row">
                {row.display_name}
                {row.status === "confirmed" && (
                  <small className="quest-here">{tr("checked in")}</small>
                )}
              </th>
              {quests.map((q) => {
                const checked = row.completed.includes(q.id);
                const key = `${q.id}:${row.user_id}`;
                return (
                  <td key={q.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={readOnly || pending !== null}
                      aria-label={`${row.display_name}: ${q.title}`}
                      onChange={() => void toggle(q.id, row.user_id, row.display_name, !checked)}
                      data-pending={pending === key}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
