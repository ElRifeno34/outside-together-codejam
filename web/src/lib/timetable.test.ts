import { describe, expect, it } from "vitest";
import type { ActivityBoardRow } from "@/lib/types";
import {
  dayHeading,
  groupByDay,
  relativeDay,
  startsIn,
  startsSoon,
  weekendDays,
} from "./timetable";

const row = (id: string, starts_at: string) => ({ id, starts_at }) as ActivityBoardRow;
// Saturday 21 Nov 2026, 18:00 in Montréal (23:00 UTC).
const saturdayEvening = new Date("2026-11-21T23:00:00.000Z");

describe("groupByDay", () => {
  it("groups by Montréal day, not UTC day, and keeps the given order", () => {
    const groups = groupByDay([
      row("sat-late", "2026-11-22T03:30:00.000Z"), // Sat 22:30 in Montréal, Sunday in UTC
      row("sun-1", "2026-11-22T14:00:00.000Z"),
      row("sun-2", "2026-11-22T19:00:00.000Z"),
      row("mon", "2026-11-23T12:00:00.000Z"),
    ]);
    expect(groups.map((g) => [g.day, g.rows.map((r) => r.id)])).toEqual([
      ["2026-11-21", ["sat-late"]],
      ["2026-11-22", ["sun-1", "sun-2"]],
      ["2026-11-23", ["mon"]],
    ]);
  });

  it("returns no groups for no rows", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("relativeDay", () => {
  it("names today and tomorrow in Montréal time", () => {
    expect(relativeDay("2026-11-21", saturdayEvening)).toBe("today");
    expect(relativeDay("2026-11-22", saturdayEvening)).toBe("tomorrow");
    expect(relativeDay("2026-11-24", saturdayEvening)).toBeNull();
  });
});

describe("weekendDays", () => {
  it("covers this Saturday and Sunday on a Saturday", () => {
    expect(weekendDays(saturdayEvening)).toEqual(["2026-11-21", "2026-11-22"]);
  });
  it("covers only Sunday on a Sunday", () => {
    expect(weekendDays(new Date("2026-11-22T15:00:00.000Z"))).toEqual(["2026-11-22"]);
  });
  it("covers the coming weekend on a weekday", () => {
    expect(weekendDays(new Date("2026-11-25T15:00:00.000Z"))).toEqual(["2026-11-28", "2026-11-29"]);
  });
});

describe("startsIn", () => {
  it("counts minutes, then hours the same day, then names the weekday", () => {
    expect(startsIn("2026-11-21T23:25:00.000Z", "en", saturdayEvening)).toBe("in 25 min");
    expect(startsIn("2026-11-21T23:25:00.000Z", "fr", saturdayEvening)).toBe("dans 25 min");
    expect(startsIn("2026-11-22T01:10:00.000Z", "en", saturdayEvening)).toBe("in 2 h");
    expect(startsIn("2026-11-22T15:00:00.000Z", "en", saturdayEvening)).toBe("Sun");
    expect(startsIn("2026-11-21T22:50:00.000Z", "en", saturdayEvening)).toBe("Started");
  });
});

describe("startsSoon", () => {
  it("is true within the hour or later the same day, false for other days", () => {
    expect(startsSoon("2026-11-21T23:25:00.000Z", saturdayEvening)).toBe(true);
    expect(startsSoon("2026-11-22T03:30:00.000Z", saturdayEvening)).toBe(true); // Sat 22:30
    expect(startsSoon("2026-11-22T15:00:00.000Z", saturdayEvening)).toBe(false);
  });
});

describe("dayHeading", () => {
  it("formats a day heading in each language", () => {
    expect(dayHeading("2026-11-23", "en")).toBe("Mon 23 Nov");
    expect(dayHeading("2026-11-23", "fr")).toMatch(/^lun\.? 23 nov\.?$/);
  });
});
