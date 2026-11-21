import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import * as api from "./index";
import { selectBoardRows } from "./board-options";
import { approvePending } from "./review-test-helpers";
beforeEach(() => {
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
    callback();
    return 0;
  }) as typeof setTimeout);
  api.resetDemo();
});
afterEach(() => vi.restoreAllMocks());
describe("Niche discovery", () => {
  it("filters each concrete niche level from 1 through 5", async () => {
    const rows = await api.getBoard();
    for (const level of [1, 2, 3, 4, 5]) {
      const filtered = selectBoardRows(rows, level, "soonest");
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((r) => r.niche_value === level)).toBe(true);
    }
  });
  it("sorts most niche first, with level 5 ahead of level 1", async () => {
    const rows = selectBoardRows(await api.getBoard(), null, "most-niche");
    expect(rows[0]?.niche_value).toBe(5);
    expect(rows.at(-1)?.niche_value).toBe(1);
    expect(rows.map((r) => r.niche_value)).toEqual(
      [...rows.map((r) => r.niche_value)].sort((a, b) => b - a),
    );
  });
  it("sorts least niche first", async () => {
    const rows = selectBoardRows(await api.getBoard(), null, "least-niche");
    expect(rows[0]?.niche_value).toBe(1);
    expect(rows.at(-1)?.niche_value).toBe(5);
  });
  it("keeps soonest first as the default and does not mutate results", async () => {
    const rows = await api.getBoard();
    const ids = rows.map((r) => r.id);
    selectBoardRows(rows, null, "most-niche");
    expect(rows.map((r) => r.id)).toEqual(ids);
    expect(selectBoardRows(rows, null, "soonest").map((r) => r.starts_at)).toEqual(
      rows.map((r) => r.starts_at).sort(),
    );
  });
});
describe("Points rankings", () => {
  it("ranks the world by total points descending", async () => {
    const rows = await api.getLeaderboard("world");
    expect(rows[0]?.display_name).toBe("Inès");
    expect(rows[0]?.total_points).toBe(260);
    expect(rows.map((r) => r.total_points)).toEqual(
      [...rows.map((r) => r.total_points)].sort((a, b) => b - a),
    );
  });
  it("assigns shared ranks to equal scores", async () => {
    const rows = await api.getLeaderboard("world");
    expect(rows.find((p) => p.id === "maya")?.rank).toBe(4);
    expect(rows.find((p) => p.id === "jules")?.rank).toBe(4);
    expect(rows.find((p) => p.id === "olivier")?.rank).toBe(6);
  });
  it("filters city rankings to Montréal or the selected city", async () => {
    const rows = await api.getLeaderboard("city");
    expect(rows).toHaveLength(5);
    expect(rows.every((p) => p.city === "Montréal")).toBe(true);
    expect((await api.getLeaderboard("city", "Paris")).map((p) => p.id)).toEqual(["ines"]);
  });
  it("filters country rankings to Canada or the selected country", async () => {
    const rows = await api.getLeaderboard("country");
    expect(rows).toHaveLength(7);
    expect(rows.every((p) => p.country === "Canada")).toBe(true);
    expect((await api.getLeaderboard("country", "France")).map((p) => p.id)).toEqual([
      "ines",
      "jules",
    ]);
  });
  it("requires a session for friends rankings", async () => {
    await expect(api.getLeaderboard("friends")).rejects.toThrow("Sign in required");
  });
  it("friends rankings include the current account and their own circle", async () => {
    await api.signIn("lea@example.com");
    expect((await api.getLeaderboard("friends")).map((p) => p.id).sort()).toEqual([
      "lea",
      "maya",
      "noa",
      "sami",
    ]);
    await api.signIn("sami@example.com");
    expect((await api.getLeaderboard("friends")).map((p) => p.id).sort()).toEqual([
      "lea",
      "noa",
      "olivier",
      "sami",
    ]);
  });
  it("new accounts have no fabricated friends", async () => {
    const profile = await api.signUp("ari@example.com", "Ari");
    expect((await api.getLeaderboard("friends")).map((p) => p.id)).toEqual([profile.id]);
  });
  it("rankings read back points earned from confirmed attendance", async () => {
    await api.signIn("lea@example.com");
    await api.confirmAttendance("finished-photo");
    await api.signIn("sami@example.com");
    await api.confirmAttendance("finished-photo");
    await approvePending("finished-photo");
    const rows = await api.getLeaderboard("friends");
    expect(rows.find((p) => p.id === "lea")?.total_points).toBe(30);
    expect(rows.find((p) => p.id === "sami")?.total_points).toBe(30);
    expect(rows.find((p) => p.id === "lea")?.rank).toBe(2);
  });
});
