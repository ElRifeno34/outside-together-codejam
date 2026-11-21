import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as api from "./index";
import { approvePending } from "./review-test-helpers";
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T19:00:00Z"));
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
    fn();
    return 0;
  }) as typeof setTimeout);
  api.resetDemo();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("offers activity-specific challenges with larger rewards for niche activities", async () => {
  expect((await api.getActivityChallenges("activity-1"))[0]?.points).toBe(15);
  expect((await api.getActivityChallenges("activity-6"))[0]?.points).toBe(35);
  expect((await api.getActivityChallenges("activity-6"))[1]?.points).toBe(10);
});
it("requires sign-in for bonus claims", async () => {
  await expect(api.completeChallenge("finished-photo", "photo-curiosity")).rejects.toThrow(
    "Sign in required",
  );
});
it("requires active membership for bonus claims", async () => {
  await api.signIn("noa@example.com");
  await expect(api.completeChallenge("finished-photo", "photo-curiosity")).rejects.toThrow(
    "Join this activity first",
  );
});
it("requires an attendance submission before a task submission", async () => {
  await api.signIn("lea@example.com");
  await expect(api.completeChallenge("finished-photo", "photo-curiosity")).rejects.toThrow(
    "Submit your attendance first",
  );
});
it("awards a completed niche task once and includes it in profile and world totals", async () => {
  await api.signIn("lea@example.com");
  await api.confirmAttendance("finished-photo");
  await api.signIn("sami@example.com");
  await api.confirmAttendance("finished-photo");
  await approvePending("finished-photo");
  await api.signIn("lea@example.com");
  expect(await api.completeChallenge("finished-photo", "photo-curiosity")).toBe(0);
  expect((await api.getMyProfile())?.total_points).toBe(30);
  await approvePending("finished-photo");
  expect(await api.completeChallenge("finished-photo", "photo-curiosity")).toBe(0);
  expect((await api.getMyProfile())?.total_points).toBe(60);
  expect((await api.getMyPoints()).map((p) => p.amount)).toEqual([30, 30]);
  expect((await api.getLeaderboard("world")).find((p) => p.id === "lea")?.total_points).toBe(60);
  expect((await api.getActivityChallenges("finished-photo"))[0]?.completed).toBe(true);
  expect(await api.confirmAttendance("finished-photo")).toBe(0);
  await api.signIn("sami@example.com");
  expect((await api.getActivityChallenges("finished-photo"))[0]?.completed).toBe(false);
  expect(await api.completeChallenge("finished-photo", "photo-curiosity")).toBe(0);
  await approvePending("finished-photo");
  expect((await api.getMyProfile())?.total_points).toBe(60);
});
it("does not accept a nonexistent challenge", async () => {
  await api.signIn("lea@example.com");
  await expect(api.completeChallenge("finished-photo", "made-up")).rejects.toThrow(
    "Challenge not found",
  );
});
it("keeps conversations private to active participants", async () => {
  await expect(api.getActivityChat("activity-1")).rejects.toThrow("Sign in required");
  await api.signIn("lea@example.com");
  await expect(api.getActivityChat("activity-1")).rejects.toThrow("Join this activity first");
  await expect(api.sendActivityMessage("activity-1", "hello")).rejects.toThrow(
    "Join this activity first",
  );
  await api.joinActivity("activity-1");
  expect(await api.getActivityChat("activity-1")).toHaveLength(2);
  await api.leaveActivity("activity-1");
  await expect(api.getActivityChat("activity-1")).rejects.toThrow("Join this activity first");
});
it("shares messages with joined accounts but not other activities", async () => {
  await api.signIn("lea@example.com");
  await api.joinActivity("activity-1");
  const sent = await api.sendActivityMessage("activity-1", "  See you by the fountain!  ");
  expect(sent.display_name).toBe("Léa");
  expect(sent.body).toBe("See you by the fountain!");
  await api.signIn("sami@example.com");
  await api.joinActivity("activity-1");
  expect((await api.getActivityChat("activity-1")).some((m) => m.id === sent.id)).toBe(true);
  await api.joinActivity("activity-2");
  expect((await api.getActivityChat("activity-2")).some((m) => m.id === sent.id)).toBe(false);
});
it("rejects blank messages", async () => {
  await api.signIn("lea@example.com");
  await api.joinActivity("activity-1");
  await expect(api.sendActivityMessage("activity-1", "   ")).rejects.toThrow(
    "Write a message between 1 and 500 characters",
  );
});
it("caps messages at 500 characters", async () => {
  await api.signIn("lea@example.com");
  await api.joinActivity("activity-1");
  await expect(api.sendActivityMessage("activity-1", "a".repeat(501))).rejects.toThrow(
    "Write a message between 1 and 500 characters",
  );
  expect((await api.sendActivityMessage("activity-1", "a".repeat(500))).body).toHaveLength(500);
});
it("resetting the demo clears messages and bonus completions", async () => {
  await api.signIn("lea@example.com");
  await api.joinActivity("activity-1");
  await api.sendActivityMessage("activity-1", "A fresh start");
  api.resetDemo();
  await api.signIn("lea@example.com");
  await api.joinActivity("activity-1");
  expect((await api.getActivityChat("activity-1")).some((m) => m.body === "A fresh start")).toBe(
    false,
  );
});
