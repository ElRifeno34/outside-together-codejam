// Pure helpers for the Explore timetable: grouping departures by Montréal day, the
// relative "in 25 min" label and the weekend window. No React, no network.
import type { ActivityBoardRow } from "@/lib/types";
import { futureDay, torontoDate } from "@/lib/time";

export type DayGroup = {
  /** Montréal calendar day, YYYY-MM-DD. */
  day: string;
  rows: ActivityBoardRow[];
};

/** Splits already-sorted rows into consecutive Montréal-day groups, keeping their order. */
export function groupByDay(rows: ActivityBoardRow[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const row of rows) {
    const day = torontoDate(row.starts_at);
    const last = groups.at(-1);
    if (last && last.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }
  return groups;
}

/** "today" / "tomorrow" or null for any other Montréal day. */
export function relativeDay(day: string, now = new Date()): "today" | "tomorrow" | null {
  if (day === torontoDate(now)) return "today";
  if (day === futureDay(1, now)) return "tomorrow";
  return null;
}

/**
 * The Saturday and Sunday the "Weekend" filter covers: this weekend, or the coming one
 * from Monday to Friday. On Sunday only Sunday is left.
 */
export function weekendDays(now = new Date()): string[] {
  const today = new Date(`${torontoDate(now)}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  if (today === 0) return [futureDay(0, now)];
  const toSaturday = 6 - today;
  return [futureDay(toSaturday, now), futureDay(toSaturday + 1, now)];
}

/** True when the start is close enough for a relative label ("in 25 min", "in 2 h", "Started"). */
export function startsSoon(startsAt: string, now = new Date()): boolean {
  const minutes = (new Date(startsAt).getTime() - now.getTime()) / 60000;
  return minutes < 60 || (minutes < 6 * 60 && torontoDate(startsAt) === torontoDate(now));
}

/** Short, departure-board style label for when an activity starts, relative to now. */
export function startsIn(startsAt: string, language: "en" | "fr", now = new Date()): string {
  const minutes = Math.round((new Date(startsAt).getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return language === "fr" ? "En cours" : "Started";
  if (minutes < 60) return language === "fr" ? `dans ${minutes} min` : `in ${minutes} min`;
  if (minutes < 6 * 60 && torontoDate(startsAt) === torontoDate(now)) {
    const hours = Math.floor(minutes / 60);
    return language === "fr" ? `dans ${hours} h` : `in ${hours} h`;
  }
  return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
  })
    .format(new Date(startsAt))
    .replace(".", "");
}

/** Day heading such as "Sun 22 Nov" / "dim. 22 nov." (Today/Tomorrow are translated by the caller). */
export function dayHeading(day: string, language: "en" | "fr"): string {
  return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));
}
