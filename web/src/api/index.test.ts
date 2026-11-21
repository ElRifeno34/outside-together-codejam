import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as api from "./index";
import { futureDay, localToISO, torontoDate } from "@/data/fixtures";
import { approvePending } from "./review-test-helpers";
// Keep the fixture calendar deterministic while skipping only simulated network latency.
const now = new Date("2026-11-20T15:00:00Z");
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
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
async function create(min = 2, capacity = 6) {
  await api.signIn("noa@example.com");
  return api.createActivity({
    type_id: "basketball",
    place_id: "court",
    starts_at: localToISO(futureDay(1), "15:00"),
    capacity,
    min_people: min,
  });
}
describe("Board and activity rules", () => {
  it("only lists future public open or confirmed activities", async () => {
    const rows = await api.getBoard();
    expect(rows).toHaveLength(22);
    expect(
      rows.every(
        (r) =>
          new Date(r.starts_at) > now &&
          r.duration_min === 60 &&
          r.place_id !== "private" &&
          ["open", "confirmed"].includes(r.status),
      ),
    ).toBe(true);
    expect(rows.some((r) => r.id === "finished-basketball")).toBe(false);
  });
  it("filters the Montréal date, activity, and time range", async () => {
    const rows = await api.getBoard({
      typeId: "basketball",
      date: torontoDate(now),
      timeFrom: "14:00",
      timeTo: "16:00",
    });
    expect(rows.map((r) => r.id)).toEqual(["friday-basketball"]);
  });
  it("requires sign-in to join", async () => {
    await expect(api.joinActivity("friday-basketball")).rejects.toThrow("Sign in required");
  });
  it("joining twice is idempotent", async () => {
    await api.signIn("lea@example.com");
    expect(await api.joinActivity("friday-basketball")).toBe(4);
    expect(await api.joinActivity("friday-basketball")).toBe(4);
  });
  it("refuses a full activity", async () => {
    const id = await create(2, 2);
    await api.signIn("lea@example.com");
    expect(await api.joinActivity(id)).toBe(2);
    await api.signIn("sami@example.com");
    await expect(api.joinActivity(id)).rejects.toThrow("Activity is full");
  });
  it("refuses registration after the start", async () => {
    await api.signIn("lea@example.com");
    await expect(api.joinActivity("finished-basketball")).rejects.toThrow("Registration is closed");
  });
  it("reaching the minimum confirms the activity", async () => {
    const id = await create();
    await api.signIn("lea@example.com");
    await api.joinActivity(id);
    expect((await api.getActivity(id)).status).toBe("confirmed");
  });
  it("leaving below minimum reopens the activity", async () => {
    const id = await create();
    await api.signIn("lea@example.com");
    await api.joinActivity(id);
    expect(await api.leaveActivity(id)).toBe(1);
    expect((await api.getActivity(id)).status).toBe("open");
  });
  it("leaving is only permitted before start", async () => {
    await api.signIn("lea@example.com");
    await expect(api.leaveActivity("finished-basketball")).rejects.toThrow(
      "Registration is closed",
    );
  });
  it("attendance is not eligible before the end", async () => {
    await api.signIn("lea@example.com");
    await api.joinActivity("friday-basketball");
    await expect(api.confirmAttendance("friday-basketball")).rejects.toThrow(
      "Activity is not eligible for attendance",
    );
  });
  it("first confirmation earns zero", async () => {
    await api.signIn("lea@example.com");
    expect(await api.confirmAttendance("finished-basketball")).toBe(0);
    expect((await api.getMyProfile())?.total_points).toBe(0);
  });
  it("two submissions earn nothing until the creator approves both, awarding 15 once", async () => {
    await api.signIn("lea@example.com");
    await api.confirmAttendance("finished-basketball");
    await api.signIn("sami@example.com");
    expect(await api.confirmAttendance("finished-basketball")).toBe(0);
    expect((await api.getMyProfile())?.total_points).toBe(0);
    await approvePending("finished-basketball");
    expect((await api.getMyProfile())?.total_points).toBe(15);
    expect((await api.getActivity("finished-basketball")).status).toBe("done");
    await api.signIn("lea@example.com");
    expect((await api.getMyProfile())?.total_points).toBe(15);
    expect(await api.confirmAttendance("finished-basketball")).toBe(0);
    expect((await api.getMyPoints()).map((p) => p.amount)).toEqual([15]);
  });
  it("photo walk earns 30 points instead of basketball’s 15", async () => {
    await api.signIn("lea@example.com");
    await api.confirmAttendance("finished-photo");
    await api.signIn("sami@example.com");
    expect(await api.confirmAttendance("finished-photo")).toBe(0);
    await approvePending("finished-photo");
    await api.signIn("lea@example.com");
    expect((await api.getMyProfile())?.total_points).toBe(30);
  });
  it("later confirmations are awarded once too", async () => {
    const id = await create();
    await api.signIn("lea@example.com");
    await api.joinActivity(id);
    await api.signIn("sami@example.com");
    await api.joinActivity(id);
    vi.setSystemTime(new Date("2026-11-22T23:00Z"));
    await api.signIn("noa@example.com");
    expect(await api.confirmAttendance(id)).toBe(0);
    await api.signIn("lea@example.com");
    expect(await api.confirmAttendance(id)).toBe(0);
    await approvePending(id);
    await api.signIn("sami@example.com");
    expect(await api.confirmAttendance(id)).toBe(0);
    await approvePending(id);
    expect(await api.confirmAttendance(id)).toBe(0);
    expect((await api.getMyProfile())?.total_points).toBe(15);
  });
  it("creation auto-registers the creator for a 60-minute public activity", async () => {
    const id = await create();
    expect((await api.getActivity(id)).joined_count).toBe(1);
    expect((await api.getActivity(id)).duration_min).toBe(60);
    expect((await api.getMyActivities()).find((p) => p.activity_id === id)?.status).toBe("joined");
  });
  it("refuses private places and never offers them in drafts", async () => {
    await api.signIn("lea@example.com");
    expect((await api.getPublicPlaces()).some((p) => p.id === "private")).toBe(false);
    await expect(
      api.createActivity({
        type_id: "walk",
        place_id: "private",
        starts_at: localToISO(futureDay(1), "15:00"),
        capacity: 6,
        min_people: 2,
      }),
    ).rejects.toThrow("Choose a public place");
  });
  it("refuses past start times", async () => {
    await api.signIn("lea@example.com");
    await expect(
      api.createActivity({
        type_id: "walk",
        place_id: "lafontaine",
        starts_at: "2026-11-19T15:00:00Z",
        capacity: 6,
        min_people: 2,
      }),
    ).rejects.toThrow("Start time must be in the future");
  });
  it("search matches Friday afternoon basketball without reserving", async () => {
    const result = await api.aiSearch("I have 1 hour Friday afternoon, I want to play basketball");
    expect(result.status).toBe("match");
    if (result.status !== "match") throw new Error("Expected match");
    expect(result.matches[0]?.id).toBe("friday-basketball");
    expect((await api.getActivity("friday-basketball")).joined_count).toBe(3);
  });
  it("French keywords match activity types", async () => {
    const result = await api.aiSearch("échecs");
    expect(result.status).toBe("match");
    if (result.status === "match")
      expect(result.matches.every((r) => r.type_id === "chess")).toBe(true);
  });
  it("no match produces a six-person draft and leaves the board unchanged", async () => {
    const before = (await api.getBoard()).length;
    const result = await api.aiSearch("urban sketch Monday morning");
    expect(result.status).toBe("no_match");
    if (result.status === "no_match") {
      expect(result.draft.capacity).toBe(6);
      expect(result.draft.type_id).toBe("sketch");
    }
    expect((await api.getBoard()).length).toBe(before);
  });
  it("simulated assistant failure returns keyword results", async () => {
    const result = await api.aiSearch("assistant unavailable chess");
    expect(result.status).toBe("fallback");
    if (result.status === "fallback")
      expect(result.matches.every((r) => r.type_id === "chess")).toBe(true);
  });
  it("fake sign-up and sign-out update session locally", async () => {
    expect(await api.getMyProfile()).toBeNull();
    expect((await api.signUp("test@example.com", "Ari")).display_name).toBe("Ari");
    await api.signOut();
    expect(await api.getMyProfile()).toBeNull();
  });
});
