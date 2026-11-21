import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as api from "./index";
import { creditsFor } from "@/data/rewards";
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
async function earn() {
  await api.signIn("lea@example.com");
  await api.confirmAttendance("finished-photo");
  await api.signIn("sami@example.com");
  await api.confirmAttendance("finished-photo");
  await api.signIn("lea@example.com");
  await api.completeChallenge("finished-photo", "photo-curiosity");
  await approvePending("finished-photo");
}
it("awards 120 credits alongside 30 attendance points at niche level 4 and 120 more for a bonus", async () => {
  await api.signIn("lea@example.com");
  await api.confirmAttendance("finished-photo");
  expect((await api.getMyWallet()).balance).toBe(0);
  await api.signIn("sami@example.com");
  await api.confirmAttendance("finished-photo");
  await approvePending("finished-photo");
  expect((await api.getMyWallet()).balance).toBe(120);
  await api.signIn("lea@example.com");
  await api.completeChallenge("finished-photo", "photo-curiosity");
  await approvePending("finished-photo");
  expect((await api.getMyWallet()).balance).toBe(240);
});
it("does not award credits twice for attendance or the same bonus", async () => {
  await earn();
  await api.confirmAttendance("finished-photo");
  await api.completeChallenge("finished-photo", "photo-curiosity");
  expect((await api.getMyWallet()).balance).toBe(240);
  expect((await api.getMyWallet()).entries).toHaveLength(2);
});
it("spends credits for customization without reducing points or leaderboard totals", async () => {
  await earn();
  await api.purchaseReward("frame-leaf");
  expect((await api.getMyWallet()).balance).toBe(220);
  expect((await api.getMyProfile())?.total_points).toBe(60);
  expect((await api.getLeaderboard("world")).find((p) => p.id === "lea")?.total_points).toBe(60);
  expect((await api.getMyWallet()).entries.map((p) => p.amount)).toEqual([120, 120, -20]);
});
it("prevents purchases with insufficient credits", async () => {
  await api.signIn("lea@example.com");
  await expect(api.purchaseReward("frame-leaf")).rejects.toThrow("Not enough credits");
  expect((await api.getMyWallet()).balance).toBe(0);
  expect((await api.getMyWallet()).purchases).toHaveLength(0);
});
it("debounces duplicate and concurrent purchases without charging twice", async () => {
  await earn();
  await Promise.all([api.purchaseReward("frame-leaf"), api.purchaseReward("frame-leaf")]);
  expect((await api.getMyWallet()).balance).toBe(220);
  expect((await api.getMyWallet()).purchases).toHaveLength(1);
});
it("requires ownership to equip and supports removal without further charges", async () => {
  await earn();
  await expect(api.equipReward("frame", "frame-leaf")).rejects.toThrow(
    "Unlock this customization first",
  );
  await api.purchaseReward("frame-leaf");
  await api.equipReward("frame", "frame-leaf");
  expect((await api.getMyProfile())?.avatar_frame).toBe("frame-leaf");
  await api.equipReward("frame", null);
  expect((await api.getMyProfile())?.avatar_frame).toBeUndefined();
  expect((await api.getMyWallet()).balance).toBe(220);
});
it("rejects equipping a badge in the frame slot", async () => {
  await earn();
  await api.purchaseReward("badge-explorer");
  await expect(api.equipReward("frame", "badge-explorer")).rejects.toThrow(
    "Unlock this customization first",
  );
  await api.equipReward("badge", "badge-explorer");
  expect((await api.getMyProfile())?.profile_badge).toBe("badge-explorer");
});
it("creates a demo-only voucher and charges the catalog price once", async () => {
  await earn();
  const voucher = await api.purchaseReward("cafe-discount");
  expect(voucher.code.startsWith("DEMO-")).toBe(true);
  expect((await api.getMyWallet()).balance).toBe(215);
  expect((await api.purchaseReward("cafe-discount")).code).toBe(voucher.code);
  expect((await api.getMyWallet()).balance).toBe(215);
});
it("isolates wallet, voucher and customization ownership by account", async () => {
  await earn();
  await api.purchaseReward("cafe-discount");
  await api.purchaseReward("frame-leaf");
  await api.equipReward("frame", "frame-leaf");
  await api.signIn("sami@example.com");
  expect((await api.getMyWallet()).balance).toBe(120);
  expect((await api.getMyWallet()).purchases).toHaveLength(0);
  expect((await api.getMyProfile())?.avatar_frame).toBeUndefined();
  await expect(api.equipReward("frame", "frame-leaf")).rejects.toThrow(
    "Unlock this customization first",
  );
});
it("requires sign-in for wallets and spending", async () => {
  await expect(api.getMyWallet()).rejects.toThrow("Sign in required");
  await expect(api.purchaseReward("frame-leaf")).rejects.toThrow("Sign in required");
  await expect(api.equipReward("frame", null)).rejects.toThrow("Sign in required");
});
it("rejects unknown catalog items", async () => {
  await earn();
  await expect(api.purchaseReward("unknown")).rejects.toThrow("Reward not found");
  expect((await api.getMyWallet()).balance).toBe(240);
});
it("clears wallet and purchases when resetting the demo", async () => {
  await earn();
  await api.purchaseReward("frame-leaf");
  api.resetDemo();
  await api.signIn("lea@example.com");
  expect((await api.getMyWallet()).balance).toBe(0);
  expect((await api.getMyWallet()).purchases).toHaveLength(0);
});
it("increases earned credits as the activity niche level increases", () => {
  expect(creditsFor(15, 1)).toBe(15);
  expect(creditsFor(35, 5)).toBe(175);
  expect(creditsFor(15, 5)).toBeGreaterThan(creditsFor(15, 1));
});
