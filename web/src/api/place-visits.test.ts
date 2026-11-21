import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as api from "./index";
import { distanceMeters, type LocationFix } from "@/data/place-discovery";
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
const fix = (lat = 45.526, lng = -73.569): LocationFix => ({
  lat,
  lng,
  accuracy: 10,
  timestamp: Date.now(),
});
it("visiting a level 1 place awards 15 points and 15 credits", async () => {
  await api.signIn("lea@example.com");
  expect(await api.checkInPlace("lafontaine", fix())).toMatchObject({ points: 15, credits: 15 });
  expect((await api.getMyProfile())?.total_points).toBe(15);
  expect((await api.getMyWallet()).balance).toBe(15);
});
it("visiting a level 5 place awards 35 points and 175 credits", async () => {
  await api.signIn("lea@example.com");
  expect(await api.checkInPlace("promenade", fix(45.505, -73.557))).toMatchObject({
    points: 35,
    credits: 175,
  });
  expect((await api.getLeaderboard("world")).find((p) => p.id === "lea")?.total_points).toBe(35);
});
it("a place visit rewards an account only once", async () => {
  await api.signIn("lea@example.com");
  await Promise.all([api.checkInPlace("lafontaine", fix()), api.checkInPlace("lafontaine", fix())]);
  expect((await api.getMyPlaces()).visits).toHaveLength(1);
  expect((await api.getMyWallet()).balance).toBe(15);
});
it("rejects a visit farther than 150 metres", async () => {
  await api.signIn("lea@example.com");
  await expect(api.checkInPlace("lafontaine", fix(45.505, -73.557))).rejects.toThrow(
    "Get within 150 m",
  );
  expect((await api.getMyWallet()).balance).toBe(0);
});
it("rejects inaccurate device location", async () => {
  await api.signIn("lea@example.com");
  await expect(api.checkInPlace("lafontaine", { ...fix(), accuracy: 101 })).rejects.toThrow(
    "Location is not precise enough",
  );
});
it("rejects stale or future location readings", async () => {
  await api.signIn("lea@example.com");
  await expect(
    api.checkInPlace("lafontaine", { ...fix(), timestamp: Date.now() - 61000 }),
  ).rejects.toThrow("Refresh your location");
  await expect(
    api.checkInPlace("lafontaine", { ...fix(), timestamp: Date.now() + 6000 }),
  ).rejects.toThrow("Refresh your location");
});
it("rejects malformed coordinates", async () => {
  await api.signIn("lea@example.com");
  await expect(api.checkInPlace("lafontaine", fix(NaN))).rejects.toThrow("Location is unavailable");
});
it("does not permit private place visits", async () => {
  await api.signIn("lea@example.com");
  await expect(api.checkInPlace("private", fix())).rejects.toThrow("Choose a public place");
});
it("requires sign-in to save and reward visits", async () => {
  await expect(api.savePlace("lafontaine", true)).rejects.toThrow("Sign in required");
  await expect(api.checkInPlace("lafontaine", fix())).rejects.toThrow("Sign in required");
});
it("keeps saved places and visit rewards isolated by account", async () => {
  await api.signIn("lea@example.com");
  await api.savePlace("lafontaine", true);
  await api.savePlace("lafontaine", true);
  await api.checkInPlace("lafontaine", fix());
  expect((await api.getMyPlaces()).saved).toEqual(["lafontaine"]);
  await api.signIn("sami@example.com");
  expect(await api.getMyPlaces()).toEqual({ saved: [], visits: [] });
  expect((await api.getMyWallet()).balance).toBe(0);
});
it("supports unsaving and does not store device coordinates", async () => {
  await api.signIn("lea@example.com");
  await api.savePlace("lafontaine", true);
  await api.savePlace("lafontaine", false);
  await api.checkInPlace("lafontaine", fix());
  const data = await api.getMyPlaces();
  expect(data.saved).toEqual([]);
  expect(data.visits[0]).not.toHaveProperty("lat");
  expect(data.visits[0]).not.toHaveProperty("lng");
});
it("calculates proximity in metres", () => {
  expect(distanceMeters(fix(), fix())).toBe(0);
  expect(distanceMeters(fix(), fix(45.527, -73.569))).toBeGreaterThan(100);
  expect(distanceMeters(fix(), fix(45.527, -73.569))).toBeLessThan(150);
});
