import { useLanguage } from "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowRight, LayoutGrid, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatStart } from "@/components/activity-card";
import { Timetable } from "@/components/departure-row";
import { levelClass, Pictogram } from "@/components/pictogram";
import { useApp } from "@/components/app-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import * as api from "@/api";
import { visualKind } from "@/lib/activity-visuals";
import { futureDay, torontoDate } from "@/lib/time";
import { dayHeading, weekendDays } from "@/lib/timetable";
import { toast } from "sonner";
import { selectBoardRows, locateOnce, type NicheSort, type Origin } from "@/api/board-options";

const boardOptions = queryOptions({ queryKey: ["board"], queryFn: () => api.getBoard() });
const typesOptions = queryOptions({ queryKey: ["types"], queryFn: api.getActivityTypes });

/** Counts change while people join: refresh quietly every minute and on returning to the tab. */
const REFRESH_MS = 60_000;

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
        content: "One hour outside, a few new faces. See what's leaving soon in Montréal.",
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

/** Which days the board shows: the strip's quick choices, or one specific day from Filters. */
type DayMode = "all" | "today" | "tomorrow" | "weekend" | "date";

const sorts: { id: NicheSort; label: string }[] = [
  { id: "soonest", label: "Soonest first" },
  { id: "nearest", label: "Nearest first" },
  { id: "most-niche", label: "Most niche first" },
  { id: "least-niche", label: "Least niche first" },
];

function Board() {
  const { tr, language } = useLanguage();
  const { activities: initial, types } = Route.useLoaderData();
  const { profile } = useApp();
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<api.BoardFilters>({});
  const [dayMode, setDayMode] = useState<DayMode>("all");
  const [nicheLevel, setNicheLevel] = useState<number | null>(null);
  const [nicheSort, setNicheSort] = useState<NicheSort>("soonest");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<api.SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const board = useQuery({
    queryKey: ["board", filters],
    queryFn: () => api.getBoard(filters),
    initialData: Object.keys(filters).length ? undefined : initial,
    // While a new filter loads, keep showing the previous list instead of an empty state.
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const my = useQuery({
    queryKey: ["my-activities", profile?.id],
    queryFn: api.getMyActivities,
    enabled: !!profile,
    refetchInterval: REFRESH_MS,
  });

  // Search: unchanged behaviour (AI when it answers in shape, keyword fallback otherwise).
  const searchVersion = useRef(0);
  const search = async (value = text) => {
    if (!value.trim()) return;
    const version = ++searchVersion.current;
    setSearching(true);
    try {
      const next = await api.aiSearch(value);
      if (version === searchVersion.current) {
        setResult(next);
        setQuery(value.trim());
      }
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      if (version === searchVersion.current) setSearching(false);
    }
  };
  const clearSearch = () => {
    searchVersion.current++;
    setResult(null);
    setText("");
    setQuery("");
    setSearching(false);
  };
  const setFilter = (key: keyof api.BoardFilters, value: string) => {
    setResult(null);
    setFilters((old) => {
      const next = { ...old };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };
  const chooseDay = (mode: DayMode, date = "") => {
    setDayMode(mode);
    setFilter(
      "date",
      mode === "today"
        ? torontoDate()
        : mode === "tomorrow"
          ? futureDay(1)
          : mode === "date"
            ? date
            : "",
    );
  };
  const chooseSort = (value: NicheSort) => {
    if (value !== "nearest") {
      setNicheSort(value);
      return;
    }
    // Location is requested only on this explicit choice and kept in memory.
    locateOnce()
      .then((position) => {
        setOrigin(position);
        setNicheSort("nearest");
      })
      .catch((err: unknown) => {
        setNicheSort("soonest");
        toast.error(tr(err instanceof Error ? err.message : "Location is unavailable"));
      });
  };
  const clearAll = () => {
    clearSearch();
    setFilters({});
    setDayMode("all");
    setNicheLevel(null);
    setNicheSort("soonest");
  };

  const weekend = weekendDays();
  const source =
    result && result.status !== "no_match"
      ? result.matches
      : (board.data ?? []).filter(
          (r) => dayMode !== "weekend" || weekend.includes(torontoDate(r.starts_at)),
        );
  const activities = selectBoardRows(source, nicheLevel, nicheSort, origin);
  const joinedIds = new Set(
    (my.data ?? []).filter((p) => p.status !== "left").map((p) => p.activity_id),
  );
  const activeFilters =
    (filters.typeId ? 1 : 0) +
    (dayMode === "date" ? 1 : 0) +
    (filters.timeFrom || filters.timeTo ? 1 : 0) +
    (nicheLevel !== null ? 1 : 0) +
    (nicheSort !== "soonest" ? 1 : 0);
  const dayChoices: { id: DayMode; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "tomorrow", label: "Tomorrow" },
    { id: "weekend", label: "Weekend" },
  ];

  return (
    <main className="page-width explore">
      <header className="explore-head">
        <h1>{tr("Leaving soon")}</h1>
        <p suppressHydrationWarning>Montréal · {dayHeading(torontoDate(), language)}</p>
      </header>

      <form
        className="explore-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Search aria-hidden="true" />
        <input
          aria-label={tr("Search activities")}
          placeholder={tr("Basketball tomorrow afternoon…")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {text && (
          <button
            type="button"
            className="explore-search-clear"
            onClick={clearSearch}
            aria-label={tr("Clear search")}
          >
            <X />
          </button>
        )}
        <Button
          type="submit"
          size="icon"
          disabled={searching || !text.trim()}
          aria-label={tr("Search")}
        >
          <ArrowRight />
        </Button>
      </form>

      <div className="explore-controls">
        <div className="day-strip" role="group" aria-label={tr("Day")}>
          {dayChoices.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={dayMode === d.id}
              onClick={() => chooseDay(dayMode === d.id ? "all" : d.id)}
            >
              {tr(d.label)}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="filters-button"
          aria-label={activeFilters ? `${tr("Filters")} (${activeFilters})` : tr("Filters")}
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal />
          <span className="filters-button-label">{tr("Filters")}</span>
          {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
        </Button>
      </div>

      {searching && (
        <p className="explore-status" role="status">
          {tr("Finding…")}
        </p>
      )}
      {result && !searching && (
        <div className="explore-status" role="status">
          <span>
            {tr("Results for")} “{query}”
          </span>
          <Button variant="link" size="sm" onClick={clearSearch}>
            {tr("Clear")}
          </Button>
        </div>
      )}
      {result?.status === "no_match" && (
        <Link
          className={`start-suggestion ${levelClass(types.find((t) => t.id === result.draft.type_id)?.niche_value ?? 1)}`}
          to="/create"
          search={{
            type: result.draft.type_id,
            place: result.draft.place_id,
            start: result.draft.starts_at,
          }}
        >
          <Pictogram
            kind={visualKind(
              types.find((t) => t.id === result.draft.type_id)?.name ?? "",
              types.find((t) => t.id === result.draft.type_id)?.keywords ?? [],
            )}
            level={types.find((t) => t.id === result.draft.type_id)?.niche_value ?? 1}
            size={36}
          />
          <span>
            <small>{tr("Nothing for that yet. Start one?")}</small>
            <strong>
              {tr(types.find((t) => t.id === result.draft.type_id)?.name ?? "Activity")} ·{" "}
              {formatStart(result.draft.starts_at, language)}
            </strong>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
      )}

      {board.error ? (
        <div className="explore-empty">
          <h2>{tr("We couldn’t load the activities.")}</h2>
          <Button onClick={() => void board.refetch()}>{tr("Try again")}</Button>
        </div>
      ) : activities.length ? (
        <Timetable rows={activities} joinedIds={joinedIds} grouped={nicheSort === "soonest"} />
      ) : result?.status !== "no_match" ? (
        <div className="explore-empty">
          <h2>{tr("Nothing leaving then.")}</h2>
          <p>{tr("Try another day, or start one yourself.")}</p>
          <div>
            <Button asChild>
              <Link to="/create">{tr("Start one")}</Link>
            </Button>
            {(activeFilters > 0 || dayMode !== "all" || result) && (
              <Button variant="link" onClick={clearAll}>
                {tr("Clear filters")}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={`filters-sheet ${isMobile ? "filters-sheet-bottom" : ""}`}
        >
          <SheetHeader>
            <SheetTitle>{tr("Filters")}</SheetTitle>
            <SheetDescription className="sr-only">
              {tr("Narrow the timetable by activity, day, time, niche level and order.")}
            </SheetDescription>
          </SheetHeader>
          <div className="filters-body">
            <fieldset>
              <legend>{tr("Activity")}</legend>
              <div className="type-grid">
                <button
                  type="button"
                  aria-pressed={!filters.typeId}
                  onClick={() => setFilter("typeId", "")}
                >
                  <span className="pictogram" style={{ "--plate": "28px" } as React.CSSProperties}>
                    <LayoutGrid />
                  </span>
                  {tr("All activities")}
                </button>
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={filters.typeId === t.id}
                    onClick={() => setFilter("typeId", filters.typeId === t.id ? "" : t.id)}
                  >
                    <Pictogram
                      kind={visualKind(t.name, t.keywords)}
                      level={t.niche_value}
                      size={28}
                    />
                    {tr(t.name)}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>{tr("Day")}</legend>
              <select
                className="filter-field"
                aria-label={tr("Filter by day")}
                value={
                  dayMode === "date" || dayMode === "today" || dayMode === "tomorrow"
                    ? (filters.date ?? "")
                    : ""
                }
                onChange={(e) =>
                  e.target.value ? chooseDay("date", e.target.value) : chooseDay("all")
                }
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
                          : dayHeading(date, language)}
                    </option>
                  );
                })}
              </select>
            </fieldset>

            <fieldset>
              <legend>{tr("Time")}</legend>
              <div className="time-range">
                <label>
                  {tr("From")}
                  <input
                    className="filter-field"
                    type="time"
                    aria-label={tr("Time from")}
                    value={filters.timeFrom ?? ""}
                    onChange={(e) => setFilter("timeFrom", e.target.value)}
                  />
                </label>
                <label>
                  {tr("Until")}
                  <input
                    className="filter-field"
                    type="time"
                    aria-label={tr("Time until")}
                    value={filters.timeTo ?? ""}
                    onChange={(e) => setFilter("timeTo", e.target.value)}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>{tr("Niche level")}</legend>
              <div className="level-choices">
                <button
                  type="button"
                  aria-pressed={nicheLevel === null}
                  onClick={() => setNicheLevel(null)}
                >
                  {tr("All levels")}
                </button>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={levelClass(n)}
                    aria-pressed={nicheLevel === n}
                    aria-label={`${tr("Niche level")} ${n} · +${10 + 5 * n} ${tr("pts")}`}
                    onClick={() => setNicheLevel(nicheLevel === n ? null : n)}
                  >
                    <span className="level-swatch" aria-hidden="true" />
                    {n}
                  </button>
                ))}
              </div>
              <p className="filters-note">
                {tr("1 is everyday, 5 is very niche. More niche, more points: +15 to +35.")}
              </p>
            </fieldset>

            <fieldset>
              <legend>{tr("Order")}</legend>
              <div className="sort-choices" role="radiogroup" aria-label={tr("Sort activities")}>
                {sorts.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={nicheSort === s.id}
                    onClick={() => chooseSort(s.id)}
                  >
                    {tr(s.label)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <SheetFooter className="filters-footer">
            <Button variant="link" onClick={clearAll}>
              {tr("Clear all")}
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              {tr("Show")} {activities.length}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  );
}
