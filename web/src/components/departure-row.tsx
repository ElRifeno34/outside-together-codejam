import { Link } from "@tanstack/react-router";
import { useLanguage } from "@/i18n";
import { torontoTime } from "@/lib/time";
import { visualKey, type ActivityBoardRow } from "@/lib/types";
import { dayHeading, groupByDay, relativeDay, startsIn, startsSoon } from "@/lib/timetable";
import { levelClass, Pictogram } from "./pictogram";
import { NicheLevel } from "./niche-level";

/**
 * One departure on the timetable: time → line stop → pictogram → activity → place →
 * occupancy and niche level. The whole row only opens the activity; it never joins.
 */
export function DepartureRow({
  activity: a,
  joined = false,
  now,
  showDay = true,
}: {
  activity: ActivityBoardRow;
  joined?: boolean;
  now: Date;
  /** Inside a day group the weekday is redundant: only "in 25 min"-style labels show. */
  showDay?: boolean;
}) {
  const { tr, language } = useLanguage();
  const happening = a.status === "confirmed" || a.status === "done";
  const full = a.available_spots <= 0;
  return (
    <li>
      <Link
        to="/activity/$id"
        params={{ id: a.id }}
        className={`departure ${levelClass(a.niche_value)}`}
        data-full={full || undefined}
      >
        <span className="departure-time">
          <time dateTime={a.starts_at}>{torontoTime(a.starts_at)}</time>
          {(showDay || startsSoon(a.starts_at, now)) && (
            // Relative to "now": the server and browser clocks differ by a few seconds.
            <small suppressHydrationWarning>{startsIn(a.starts_at, language, now)}</small>
          )}
        </span>
        <span
          className="departure-stop"
          data-state={happening ? "happening" : "open"}
          data-joined={joined || undefined}
          aria-hidden="true"
        />
        <Pictogram kind={visualKey(a)} level={a.niche_value} size={36} />
        <span className="departure-main">
          <strong>{tr(a.activity_name)}</strong>
          <span>{tr(a.place_name)}</span>
          {(joined || happening) && (
            <span className="departure-flags">
              {joined && <em className="departure-joined">{tr("You're in")}</em>}
              {happening && <em>{tr("It’s happening")}</em>}
            </span>
          )}
        </span>
        <span className="departure-side">
          <span className="departure-count">
            {full ? (
              tr("Full")
            ) : (
              <>
                {a.joined_count}
                <span aria-hidden="true">/</span>
                <span className="sr-only"> {tr("of")} </span>
                {a.capacity}
              </>
            )}
          </span>
          <NicheLevel level={a.niche_value} />
        </span>
      </Link>
    </li>
  );
}

/** Departures grouped under Montréal day headings, or as one flat list for non-time sorts. */
export function Timetable({
  rows,
  joinedIds,
  grouped,
}: {
  rows: ActivityBoardRow[];
  joinedIds: Set<string>;
  grouped: boolean;
}) {
  const { tr, language } = useLanguage();
  const now = new Date();
  const list = (items: ActivityBoardRow[]) => (
    <ol className="timetable-list">
      {items.map((a) => (
        <DepartureRow
          key={a.id}
          activity={a}
          joined={joinedIds.has(a.id)}
          now={now}
          showDay={!grouped}
        />
      ))}
    </ol>
  );
  if (!grouped) return <div className="timetable">{list(rows)}</div>;
  return (
    <div className="timetable">
      {groupByDay(rows).map((g) => {
        const rel = relativeDay(g.day, now);
        return (
          <section key={g.day} className="timetable-day" aria-label={dayHeading(g.day, language)}>
            <h3 className="timetable-day-heading">
              {rel ? (
                <>
                  {tr(rel === "today" ? "Today" : "Tomorrow")}
                  <span>{dayHeading(g.day, language)}</span>
                </>
              ) : (
                dayHeading(g.day, language)
              )}
            </h3>
            {list(g.rows)}
          </section>
        );
      })}
    </div>
  );
}
