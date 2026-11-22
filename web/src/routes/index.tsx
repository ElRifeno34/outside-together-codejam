import { useLanguage } from "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  MapPin,
  Clock3,
  Sprout,
  Sun,
  X,
  Users,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActivityCard, activityIcons, formatStart } from "@/components/activity-card";
import { useApp } from "@/components/app-provider";
import * as api from "@/api";
import { visualKind } from "@/api/supabase-backend";
import { futureDay } from "@/data/fixtures";
import { toast } from "sonner";
import { selectBoardRows, locateOnce, type NicheSort, type Origin } from "@/api/board-options";
const boardOptions = queryOptions({ queryKey: ["board"], queryFn: () => api.getBoard() });
const typesOptions = queryOptions({ queryKey: ["types"], queryFn: api.getActivityTypes });
const sorts = [
  ["soonest", "Soonest first"],
  ["nearest", "Nearest first"],
  ["most-niche", "Most niche first"],
  ["least-niche", "Least niche first"],
] as const satisfies readonly (readonly [NicheSort, string])[];
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Explore Montréal · Outside Together" },
      {
        name: "description",
        content: "Find your next one-hour walk, basketball game, or creative meetup in Montréal.",
      },
      { property: "og:title", content: "Explore Montréal · Outside Together" },
      {
        property: "og:description",
        content:
          "A little time outside. A few new faces. Browse spontaneous activities in Montréal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    const [activities, types] = await Promise.all([
      context.queryClient.ensureQueryData(boardOptions),
      context.queryClient.ensureQueryData(typesOptions),
    ]);
    return { activities, types };
  },
  component: Board,
});
function Board() {
  const { tr, language } = useLanguage();
  const { activities: initial, types } = Route.useLoaderData();
  const { profile } = useApp();
  const [filters, setFilters] = useState<api.BoardFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isMobile = useIsMobile();
  const [nicheLevel, setNicheLevel] = useState<number | null>(null);
  const [nicheSort, setNicheSort] = useState<NicheSort>("soonest");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<api.SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const board = useQuery({
    queryKey: ["board", filters],
    queryFn: () => api.getBoard(filters),
    initialData: Object.keys(filters).length === 0 ? initial : undefined,
    placeholderData: keepPreviousData,
  });
  const my = useQuery({
    queryKey: ["my-activities", profile?.id],
    queryFn: api.getMyActivities,
    enabled: !!profile,
  });
  const searchVersion = useRef(0);
  const sortVersion = useRef(0);
  const search = async (value = text) => {
    if (!value.trim()) return;
    const version = ++searchVersion.current;
    setSearching(true);
    try {
      const next = await api.aiSearch(value);
      if (version === searchVersion.current) setResult(next);
    } catch (e) {
      if (version === searchVersion.current) {
        toast.error(tr(e instanceof Error ? e.message : "Please try again"));
      }
    } finally {
      if (version === searchVersion.current) setSearching(false);
    }
  };
  const dismissSearchResults = () => {
    searchVersion.current++;
    setSearching(false);
    setResult(null);
  };
  const setFilter = (key: keyof api.BoardFilters, value: string) => {
    dismissSearchResults();
    setFilters((old) => {
      const next = { ...old };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };
  const chooseSort = async (sort: NicheSort) => {
    const version = ++sortVersion.current;
    if (sort !== "nearest") {
      setNicheSort(sort);
      return;
    }
    try {
      // Location is requested only on this explicit choice and kept in memory.
      const position = await locateOnce();
      if (version !== sortVersion.current) return;
      setOrigin(position);
      setNicheSort(sort);
    } catch (error) {
      if (version !== sortVersion.current) return;
      setNicheSort("soonest");
      toast.error(tr(error instanceof Error ? error.message : "Location is unavailable"));
    }
  };
  const clearFilters = () => {
    setFilters({});
    dismissSearchResults();
    setNicheLevel(null);
    void chooseSort("soonest");
  };
  const activeFilters =
    Number(Boolean(filters.typeId)) +
    Number(Boolean(filters.date)) +
    Number(Boolean(filters.timeFrom || filters.timeTo)) +
    Number(nicheLevel !== null) +
    Number(nicheSort !== "soonest");
  const activities = selectBoardRows(
    result && result.status !== "no_match" ? result.matches : (board.data ?? []),
    nicheLevel,
    nicheSort,
    origin,
  );
  const refresh = async () => {
    await board.refetch();
    if (result && result.status !== "no_match") await search();
    toast.success(tr("Activity counts are up to date"));
  };
  return (
    <main className="page-width">
      <section className="intro">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            {tr("A little time. A little company.")}
          </div>
          <h1>
            {tr("One hour.")} <em>{tr("Outside Together.")}</em>
          </h1>
          <p>{tr("Find your people, try something new, and make Montréal a little smaller.")}</p>
        </div>
        <div className="intro-note">
          <span className="note-icon">
            <Sun size={24} />
          </span>
          <p>
            <strong>{tr("Good things happen outside.")}</strong>
            {tr("No big plans needed.")}
          </p>
        </div>
      </section>
      <section className="search-band" aria-label={tr("Activity assistant")}>
        <h2 className="search-heading">
          <Sparkles size={18} />
          {tr("What do you feel like doing?")}
        </h2>
        <form
          className="search-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <Search size={18} />
          <input
            aria-label={tr("Describe your activity")}
            placeholder={tr("I have an hour this afternoon. Anyone up for a walk?")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={searching}>
            {searching ? tr("Finding…") : tr("Find my people")}
            <ArrowRight />
          </Button>
        </form>
        <div className="search-suggestions">
          <span>{tr("A little inspiration:")}</span>
          {["Basketball Friday afternoon", "A photo walk tomorrow", "Chess in the park"].map(
            (s) => (
              <Button
                key={tr(s ?? "")}
                variant="pill"
                onClick={() => {
                  setText(tr(s));
                  void search(tr(s));
                }}
              >
                {tr(s ?? "")}
                <ArrowUpRight size={11} />
              </Button>
            ),
          )}
        </div>
      </section>
      {result && (
        <div
          className={`result-banner ${result.status === "fallback" ? "fallback" : ""}`}
          role="status"
        >
          <span>
            {result.status === "fallback"
              ? tr("Assistant unavailable, showing keyword results")
              : tr(result.message)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={tr("Clear search")}
            onClick={() => {
              setResult(null);
              setText("");
            }}
          >
            <X />
          </Button>
        </div>
      )}
      {result?.status === "no_match" && (
        <div className="search-draft">
          <div>
            <div className="eyebrow">{tr("Your next little adventure")}</div>
            <h3>
              {tr(types.find((t) => t.id === result.draft.type_id)?.name ?? "Activity")} {" · "}{" "}
              {formatStart(result.draft.starts_at, language)}
            </h3>
            <p>{tr("Start a group at a public Montréal spot. There’s room for 6.")}</p>
            <span className="points-label">
              <Sparkles size={14} />
              {tr("A new plan, not a reservation.")}
            </span>
          </div>
          <Button asChild>
            <Link
              to="/create"
              search={{
                type: result.draft.type_id,
                place: result.draft.place_id,
                start: result.draft.starts_at,
              }}
            >
              {tr("Review draft")}
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      )}
      <section className="discovery-band">
        <div>
          <h2>{tr("Something ordinary. Something unexpected.")}</h2>
          <p>
            {tr("Picnics, coffee, moss spotting, sound safaris. There’s an hour for everyone.")}
          </p>
        </div>
        <div className="discovery-actions">
          <Button
            variant="outline"
            onClick={() => {
              setNicheLevel(1);
              setFilters({});
              setResult(null);
            }}
          >
            {tr("Everyday")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setNicheLevel(5);
              setFilters({});
              setResult(null);
            }}
          >
            <Sparkles />
            {tr("Very niche")}
          </Button>
        </div>
      </section>
      <div className="board-heading">
        <h2>
          {result && result.status !== "no_match" ? tr("Your matches") : tr("Find your next hour")}
          <span>
            {activities.length} {tr("activities")}
          </span>
        </h2>
        <Button
          variant="ghost"
          className="refresh-button"
          disabled={board.isFetching || searching}
          onClick={() => void refresh()}
          aria-label={tr("Refresh activities")}
        >
          <RefreshCw className={board.isFetching ? "animate-spin" : ""} />
          <span>{tr("Refresh")}</span>
        </Button>
      </div>
      <div className="explore-filter-bar">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal />
              {tr("Filters")}
              {activeFilters > 0 && <span className="explore-filter-count">{activeFilters}</span>}
            </Button>
          </SheetTrigger>
          <SheetContent
            side={isMobile ? "bottom" : "right"}
            className={
              isMobile ? "explore-filter-sheet explore-filter-sheet-bottom" : "explore-filter-sheet"
            }
          >
            <SheetHeader className="explore-filter-header">
              <SheetTitle>{tr("Filters")}</SheetTitle>
              <SheetDescription className="sr-only">{tr("Activity filters")}</SheetDescription>
            </SheetHeader>
            <div className="explore-filter-body">
              <fieldset>
                <legend>{tr("Activity")}</legend>
                <div className="explore-filter-choices">
                  <Button
                    variant="outline"
                    aria-pressed={!filters.typeId}
                    onClick={() => setFilter("typeId", "")}
                  >
                    <LayoutGrid />
                    {tr("All activities")}
                  </Button>
                  {types.map((type) => {
                    const Icon = activityIcons[type.id as keyof typeof activityIcons] ?? Sprout;
                    return (
                      <Button
                        key={type.id}
                        variant="outline"
                        aria-pressed={filters.typeId === type.id}
                        onClick={() =>
                          setFilter("typeId", filters.typeId === type.id ? "" : type.id)
                        }
                      >
                        <Icon />
                        {tr(type.name)}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend>{tr("Day")}</legend>
                <select
                  className="filter-select"
                  aria-label={tr("Filter by day")}
                  value={filters.date ?? ""}
                  onChange={(e) => setFilter("date", e.target.value)}
                >
                  <option value="">{tr("Any day")}</option>
                  {Array.from({ length: 8 }, (_, i) => {
                    const date = futureDay(i);
                    return (
                      <option key={date} value={date}>
                        {i === 0
                          ? tr("Today")
                          : i === 1
                            ? tr("Tomorrow")
                            : new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                              }).format(new Date(date + "T12:00Z"))}
                      </option>
                    );
                  })}
                </select>
              </fieldset>
              <fieldset>
                <legend>{tr("Time")}</legend>
                <div className="explore-filter-choices">
                  <label className="field">
                    {tr("From")}
                    <input
                      aria-label={tr("Time from")}
                      type="time"
                      value={filters.timeFrom ?? ""}
                      onChange={(e) => setFilter("timeFrom", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    {tr("Until")}
                    <input
                      aria-label={tr("Time until")}
                      type="time"
                      value={filters.timeTo ?? ""}
                      onChange={(e) => setFilter("timeTo", e.target.value)}
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>{tr("Niche level")}</legend>
                <div className="explore-filter-levels">
                  <Button
                    variant="outline"
                    aria-pressed={nicheLevel === null}
                    onClick={() => setNicheLevel(null)}
                  >
                    {tr("All levels")}
                  </Button>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <Button
                      key={level}
                      variant="outline"
                      aria-pressed={nicheLevel === level}
                      aria-label={[
                        tr("Niche level"),
                        level,
                        "·",
                        "+" + (10 + 5 * level),
                        tr("pts"),
                      ].join(" ")}
                      onClick={() => setNicheLevel(nicheLevel === level ? null : level)}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
                <details className="niche-legend">
                  <summary>{tr("What do levels mean?")}</summary>
                  <div>
                    {[
                      "Everyday · Walk, Basketball",
                      "A little different · Study outside",
                      "Special interest · Chess",
                      "Creative interest · Photo walk",
                      "Most niche · Urban sketching",
                    ].map((label, i) => (
                      <p key={tr(label ?? "")}>
                        <strong>{i + 1}</strong>
                        <span>{tr(label ?? "")}</span>
                        <span>
                          {tr("+")}
                          {15 + 5 * i} {tr("pts")}
                        </span>
                      </p>
                    ))}
                    <small>
                      {tr("Points unlock when 2 participants check in.")}
                    </small>
                  </div>
                </details>
              </fieldset>
              <fieldset>
                <legend>{tr("Sort")}</legend>
                <div className="explore-filter-choices">
                  {sorts.map(([value, label]) => (
                    <label key={value} className="explore-sort-choice">
                      <input
                        type="radio"
                        name="explore-sort"
                        checked={nicheSort === value}
                        onChange={() => chooseSort(value)}
                      />
                      {tr(label)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <SheetFooter className="explore-filter-footer">
              <Button variant="ghost" onClick={clearFilters}>
                {tr("Clear filters")}
              </Button>
              <SheetClose asChild>
                <Button>{tr("Show activities")}</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      <div className="board-subline">
        <span>
          <MapPin />
          {tr("Public places. Real connections.")}
        </span>
        <span>
          <Clock3 />
          {tr("Every activity is just 1 hour")}
        </span>
      </div>
      {board.error ? (
        <div className="empty-state">
          <h2>{tr("We couldn’t load the activities.")}</h2>
          <Button onClick={() => void board.refetch()}>{tr("Try again")}</Button>
        </div>
      ) : activities.length ? (
        <div className="activity-grid">
          {activities.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              joined={!!my.data?.some((p) => p.activity_id === a.id && p.status !== "left")}
              onChanged={() => {
                void board.refetch();
                if (result) void search();
              }}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={30} />
          <h2>{tr("No plans here just yet.")}</h2>
          <p>{tr("Try another day, or get something started yourself.")}</p>
          <Button variant="outline" onClick={clearFilters}>
            {tr("Clear filters")}
          </Button>
          <Button asChild className="ml-2">
            <Link to="/create">
              {tr("Create activity")}
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      )}
      <div className="board-end">
        <Sprout />
        {tr("A whole city of possibilities. One hour at a time.")}
      </div>
      <section className="points-band">
        <Sparkles />
        <div>
          <h3>{tr("Try something a little different. Earn a little more.")}</h3>
          <p>
            {tr(
              "The more niche the activity, the more points you earn together. Good company always comes first.",
            )}
          </p>
        </div>
        <Link to="/profile">
          {tr("My points")}
          <ArrowUpRight size={14} />
        </Link>
      </section>
    </main>
  );
}
