import { useLanguage } from "@/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Globe2,
  Link2,
  MapPin,
  RefreshCw,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import type { Area, LeaderboardRow, RankingScope } from "@/lib/types";
import * as api from "@/api";

export const Route = createFileRoute("/rankings")({
  validateSearch: z.object({
    tab: z.enum(["area", "world", "friends"]).optional(),
    /** Invite links: /rankings?friend=ABC123 pre-fills "Add a friend". */
    friend: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Rankings · Outside Together" },
      {
        name: "description",
        content:
          "See who gets outside the most: in your Montréal neighbourhood, worldwide and among friends.",
      },
    ],
  }),
  component: RankingsPage,
});

const tabs: { id: RankingScope; label: string; Icon: typeof Users }[] = [
  { id: "area", label: "My area", Icon: MapPin },
  { id: "world", label: "World", Icon: Globe2 },
  { id: "friends", label: "Friends", Icon: Users },
];

function RankingsPage() {
  const { tr } = useLanguage();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/rankings" });
  const { profile, openAuth } = useApp();
  const client = useQueryClient();
  const tab: RankingScope = search.tab ?? (search.friend ? "friends" : "area");

  const areas = useQuery({ queryKey: ["areas"], queryFn: () => api.getAreas() });
  const myArea = useQuery({
    queryKey: ["my-area", profile?.id],
    queryFn: () => api.getMyArea(),
    enabled: !!profile,
  });
  const [area, setArea] = useState<string>("");
  // Show the person's own area until they pick another one.
  const shownArea = area || myArea.data || "";

  const board = useQuery({
    queryKey: ["leaderboard", tab, tab === "area" ? shownArea : null, profile?.id],
    queryFn: () => api.getLeaderboard(tab, tab === "area" ? shownArea : null),
    enabled: tab !== "friends" ? tab === "world" || !!shownArea : !!profile,
  });

  const saveArea = async (name: string) => {
    try {
      await api.setMyArea(name);
      setArea("");
      await client.invalidateQueries({ queryKey: ["my-area"] });
      await client.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(`${tr("Your area is now")} ${name}`);
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    }
  };

  return (
    <main className="page-width rankings-page">
      <div className="page-title">
        <div className="eyebrow">
          <Trophy size={15} /> {tr("A little friendly competition")}
        </div>
        <h1>{tr("Good company. Great company.")}</h1>
        <p>{tr("Every hour outside adds up: activities and places you visit both count.")}</p>
      </div>

      <div className="ranking-bar">
        <div className="ranking-tabs" role="tablist" aria-label={tr("Ranking")}>
          {tabs.map(({ id, label, Icon }) => (
            <Button
              key={id}
              role="tab"
              aria-selected={tab === id}
              variant="pill"
              data-active={tab === id}
              onClick={() => void navigate({ search: (s) => ({ ...s, tab: id }) })}
            >
              <Icon />
              {tr(label)}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tr("Refresh")}
          disabled={board.isFetching}
          onClick={() => void board.refetch()}
        >
          <RefreshCw />
        </Button>
      </div>

      {tab === "area" && (
        <AreaPicker
          areas={areas.data ?? []}
          value={shownArea}
          mine={myArea.data ?? null}
          signedIn={!!profile}
          onPick={setArea}
          onSave={(name) => void saveArea(name)}
        />
      )}

      {tab === "friends" &&
        (profile ? (
          <FriendsPanel
            invite={search.friend}
            onChanged={() => void client.invalidateQueries({ queryKey: ["leaderboard"] })}
          />
        ) : (
          <div className="empty-state">
            <Users size={30} />
            <h2>{tr("Rank with your friends")}</h2>
            <p>
              {tr("Sign in with Google, share your friend code, and see who gets outside more.")}
            </p>
            <Button onClick={() => openAuth()}>{tr("Sign in")}</Button>
          </div>
        ))}

      {board.isError ? (
        <div className="empty-state">
          <h2>{tr("Rankings aren't set up yet.")}</h2>
          <p>{tr("Run migration 013 in Supabase, then reload.")}</p>
        </div>
      ) : tab === "area" && !shownArea ? null : tab === "friends" && !profile ? null : (
        <Leaderboard
          rows={board.data ?? []}
          loading={board.isLoading}
          friends={tab === "friends"}
          onRemoved={() => void client.invalidateQueries({ queryKey: ["leaderboard"] })}
        />
      )}
    </main>
  );
}

function AreaPicker(props: {
  areas: Area[];
  value: string;
  mine: string | null;
  signedIn: boolean;
  onPick: (name: string) => void;
  onSave: (name: string) => void;
}) {
  const { tr } = useLanguage();
  const groups = useMemo(
    () => [
      { label: "Montréal boroughs", items: props.areas.filter((a) => a.kind === "borough") },
      { label: "Suburbs", items: props.areas.filter((a) => a.kind === "suburb") },
    ],
    [props.areas],
  );
  return (
    <div className="area-picker">
      <label className="field">
        {tr("Neighbourhood or suburb")}
        <select value={props.value} onChange={(e) => props.onPick(e.target.value)}>
          <option value="" disabled>
            {tr("Choose an area…")}
          </option>
          {groups.map((g) => (
            <optgroup key={g.label} label={tr(g.label)}>
              {g.items.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                  {a.name === props.mine ? ` (${tr("yours")})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {props.signedIn && props.value && props.value !== props.mine && (
        <Button variant="outline" onClick={() => props.onSave(props.value)}>
          <MapPin />
          {tr(props.mine ? "Move me to this area" : "This is my area")}
        </Button>
      )}
      {props.signedIn && !props.mine && !props.value && (
        <p className="area-hint">{tr("Pick where you live to join its ranking.")}</p>
      )}
    </div>
  );
}

function FriendsPanel({
  invite,
  onChanged,
}: {
  invite?: string | undefined;
  onChanged: () => void;
}) {
  const { tr } = useLanguage();
  const code = useQuery({ queryKey: ["friend-code"], queryFn: () => api.getMyFriendCode() });
  const [input, setInput] = useState(invite ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (invite) setInput(invite);
  }, [invite]);
  const inviteLink = code.data
    ? `${window.location.origin}/rankings?friend=${encodeURIComponent(code.data)}`
    : "";
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tr(done));
    } catch {
      toast.error(tr("Couldn't copy. Select it and copy by hand."));
    }
  };
  const add = async () => {
    setBusy(true);
    try {
      const friend = await api.addFriend(input);
      toast.success(`${friend.display_name} ${tr("is now your friend")}`);
      setInput("");
      onChanged();
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="friends-panel">
      <div className="friend-code">
        <span>{tr("Your friend code")}</span>
        <strong aria-live="polite">{code.data ?? "······"}</strong>
        <div className="friend-code-actions">
          <Button
            variant="outline"
            size="sm"
            disabled={!code.data}
            onClick={() => void copy(code.data ?? "", "Code copied")}
          >
            <Copy /> {tr("Copy code")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!inviteLink}
            onClick={() => void copy(inviteLink, "Invite link copied")}
          >
            <Link2 /> {tr("Copy invite link")}
          </Button>
        </div>
      </div>
      <form
        className="friend-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) void add();
        }}
      >
        <label className="field">
          {tr("Add a friend")}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={12}
            autoComplete="off"
            aria-label={tr("Friend code")}
          />
        </label>
        <Button type="submit" disabled={busy || !input.trim()}>
          <UserPlus /> {tr(busy ? "Adding…" : "Add")}
        </Button>
      </form>
    </div>
  );
}

function Leaderboard(props: {
  rows: LeaderboardRow[];
  loading: boolean;
  friends: boolean;
  onRemoved: () => void;
}) {
  const { tr } = useLanguage();
  if (props.loading) return <p className="ranking-empty">{tr("Loading rankings…")}</p>;
  if (!props.rows.length)
    return (
      <p className="ranking-empty">
        {tr(
          props.friends
            ? "No friends yet. Share your code to start a little competition."
            : "No one here yet. Be the first!",
        )}
      </p>
    );
  if (props.friends && props.rows.length === 1)
    return (
      <>
        <RankingList {...props} />
        <p className="ranking-empty">
          {tr("No friends yet. Share your code to start a little competition.")}
        </p>
      </>
    );
  return <RankingList {...props} />;
}

function RankingList({
  rows,
  friends,
  onRemoved,
}: {
  rows: LeaderboardRow[];
  friends: boolean;
  onRemoved: () => void;
}) {
  const { tr } = useLanguage();
  const remove = async (row: LeaderboardRow) => {
    if (!window.confirm(`${tr("Remove")} ${row.display_name} ${tr("from your friends?")}`)) return;
    try {
      await api.removeFriend(row.user_id);
      toast.success(`${row.display_name} ${tr("was removed from your friends")}`);
      onRemoved();
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    }
  };
  return (
    <ol className="ranking-list">
      {rows.map((row, i) => (
        <li
          key={row.user_id}
          className="ranking-row"
          data-me={row.is_me}
          data-gap={i > 0 && row.rank > (rows[i - 1]?.rank ?? 0) + 1 && row.is_me}
        >
          <span className="ranking-rank" data-podium={row.rank <= 3 ? row.rank : undefined}>
            {row.rank}
          </span>
          <span className="ranking-avatar" aria-hidden="true">
            {row.display_name.charAt(0).toUpperCase()}
          </span>
          <span className="ranking-name">
            <strong>
              {row.display_name}
              {row.is_me && <em> · {tr("you")}</em>}
            </strong>
            {row.area && <small>{row.area}</small>}
          </span>
          <span className="ranking-points">
            {row.total_points} <small>{tr("pts")}</small>
          </span>
          {friends && !row.is_me && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${tr("Remove")} ${row.display_name}`}
              onClick={() => void remove(row)}
            >
              <UserMinus />
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}
