import { beforeEach, afterEach, it, expect, vi } from "vitest";
import * as api from "./index";
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
    callback();
    return 0;
  }) as typeof setTimeout);
  api.resetDemo();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("offers everyday picnic, coffee, and jog outings on the board", async () => {
  const types = (await api.getBoard()).map((a) => a.type_id);
  expect(types).toContain("picnic");
  expect(types).toContain("coffee");
  expect(types).toContain("jog");
});
it("offers very niche moss spotting and sound safari at level 5", async () => {
  const rows = await api.getBoard();
  expect(rows.find((a) => a.type_id === "moss")?.niche_value).toBe(5);
  expect(rows.find((a) => a.type_id === "sound")?.niche_value).toBe(5);
});
it("random discovery only chooses public places and excludes the previous place", async () => {
  const first = await api.getRandomPlace();
  expect(first?.is_public).toBe(true);
  const second = await api.getRandomPlace(first?.id);
  expect(second?.is_public).toBe(true);
  expect(second?.id).not.toBe(first?.id);
});
it("French Friday afternoon basketball matches the Montréal calendar", async () => {
  const result = await api.aiSearch("J’ai une heure vendredi après-midi pour jouer au basketball");
  expect(result.status).toBe("match");
  if (result.status !== "match") throw new Error("Expected match");
  expect(result.matches[0]?.id).toBe("friday-basketball");
  expect((await api.getActivity("friday-basketball")).joined_count).toBe(3);
});
it("French very niche keywords find moss spotting", async () => {
  const result = await api.aiSearch("Observer les mousses et lichens");
  expect(result.status).toBe("match");
  if (result.status === "match")
    expect(result.matches.some((a) => a.type_id === "moss")).toBe(true);
});
it("publishes new types at the new public places", async () => {
  await api.signIn("noa@example.com");
  const id = await api.createActivity({
    type_id: "sound",
    place_id: "canal",
    starts_at: "2026-11-21T20:00:00Z",
    capacity: 6,
    min_people: 2,
  });
  const row = await api.getActivity(id);
  expect(row.type_id).toBe("sound");
  expect(row.place_id).toBe("canal");
  expect(row.duration_min).toBe(60);
  expect(row.joined_count).toBe(1);
});
