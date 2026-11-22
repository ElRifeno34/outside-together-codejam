import { describe, expect, it } from "vitest";
import { selectBoardRows } from "./board-options";
import type { ActivityBoardRow } from "@/lib/types";

const row = (id: string, niche: number, starts: string): ActivityBoardRow => ({
  id,
  type_id: `type-${id}`,
  activity_name: id,
  niche_value: niche,
  place_id: "p",
  place_name: "Place",
  address: "",
  lat: 45.5,
  lng: -73.57,
  starts_at: starts,
  duration_min: 60,
  capacity: 6,
  min_people: 2,
  status: "open",
  joined_count: 1,
  available_spots: 5,
  creator_id: "",
});

const rows = [
  row("walk", 1, "2099-01-01T15:00:00.000Z"),
  row("moss", 5, "2099-01-01T17:00:00.000Z"),
  row("chess", 3, "2099-01-01T16:00:00.000Z"),
  row("jog", 1, "2099-01-01T14:00:00.000Z"),
];

describe("niche filters and sorting", () => {
  it("filters each concrete niche level", () => {
    expect(selectBoardRows(rows, 1, "soonest").map((r) => r.id)).toEqual(["jog", "walk"]);
    expect(selectBoardRows(rows, 5, "soonest").map((r) => r.id)).toEqual(["moss"]);
    expect(selectBoardRows(rows, 2, "soonest")).toEqual([]);
  });

  it("sorts most niche first, then soonest", () => {
    expect(selectBoardRows(rows, null, "most-niche").map((r) => r.id)).toEqual([
      "moss",
      "chess",
      "jog",
      "walk",
    ]);
  });

  it("sorts least niche first, then soonest", () => {
    expect(selectBoardRows(rows, null, "least-niche").map((r) => r.id)).toEqual([
      "jog",
      "walk",
      "chess",
      "moss",
    ]);
  });

  it("keeps soonest first as the default and does not mutate the input", () => {
    const before = rows.map((r) => r.id);
    expect(selectBoardRows(rows, null, "soonest").map((r) => r.id)).toEqual([
      "jog",
      "walk",
      "chess",
      "moss",
    ]);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});
