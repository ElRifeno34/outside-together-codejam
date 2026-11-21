import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as api from "./index";
import { futureDay, localToISO } from "@/data/fixtures";
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
async function submitBoth() {
  await api.signIn("lea@example.com");
  await api.confirmAttendance("finished-photo");
  await api.signIn("sami@example.com");
  await api.confirmAttendance("finished-photo");
  await api.signIn("noa@example.com");
  return (await api.getActivityReview("finished-photo")).requests;
}
it("attendance submissions remain pending with zero points and credits", async () => {
  await api.signIn("lea@example.com");
  await api.confirmAttendance("finished-photo");
  await api.confirmAttendance("finished-photo");
  const review = await api.getActivityReview("finished-photo");
  expect(review.requests).toHaveLength(1);
  expect(review.requests[0]?.status).toBe("pending");
  expect((await api.getMyProfile())?.total_points).toBe(0);
  expect((await api.getMyWallet()).balance).toBe(0);
  expect(
    (await api.getMyActivities()).find((p) => p.activity_id === "finished-photo")?.status,
  ).toBe("joined");
});
it("the event creator can approve attendance, with rewards after two approvals", async () => {
  const requests = await submitBoth();
  const lea = requests.find((r) => r.user_id === "lea");
  const sami = requests.find((r) => r.user_id === "sami");
  if (!lea || !sami) throw new Error("Expected both submissions");
  expect((await api.getActivityReview("finished-photo")).can_review).toBe(true);
  await api.reviewActivityRequest(lea.id, "approved");
  await api.signIn("lea@example.com");
  expect((await api.getMyWallet()).balance).toBe(0);
  await api.signIn("noa@example.com");
  await api.reviewActivityRequest(sami.id, "approved");
  await api.signIn("lea@example.com");
  expect((await api.getMyProfile())?.total_points).toBe(30);
  expect((await api.getMyWallet()).balance).toBe(120);
});
it("an admin who is not the event creator can approve someone else's attendance", async () => {
  await api.signIn("lea@example.com");
  await api.confirmAttendance("finished-photo");
  await api.signIn("sami@example.com");
  const request = (await api.getActivityReview("finished-photo")).requests[0];
  if (!request) throw new Error("Expected submission");
  expect((await api.getActivity("finished-photo")).creator_id).toBe("noa");
  await api.reviewActivityRequest(request.id, "approved");
  expect((await api.getActivityReview("finished-photo")).requests[0]?.reviewed_by).toBe("sami");
});
it("ordinary participants cannot approve attendance or tasks", async () => {
  const requests = await submitBoth();
  const request = requests.find((r) => r.user_id === "sami");
  if (!request) throw new Error("Expected submission");
  await api.signIn("lea@example.com");
  await expect(api.reviewActivityRequest(request.id, "approved")).rejects.toThrow(
    "Only the event creator or an admin can review",
  );
  expect((await api.getActivityReview("finished-photo")).requests.map((r) => r.user_id)).toEqual([
    "lea",
  ]);
  await api.completeChallenge("finished-photo", "photo-curiosity");
  const own = (await api.getActivityReview("finished-photo")).requests.find(
    (r) => r.kind === "task",
  );
  if (!own) throw new Error("Expected task");
  await expect(api.reviewActivityRequest(own.id, "approved")).rejects.toThrow(
    "Only the event creator or an admin can review",
  );
});
it("admins cannot approve their own attendance or task claims", async () => {
  await api.signIn("sami@example.com");
  await api.confirmAttendance("finished-photo");
  await api.completeChallenge("finished-photo", "photo-curiosity");
  for (const request of (await api.getActivityReview("finished-photo")).requests) {
    await expect(api.reviewActivityRequest(request.id, "approved")).rejects.toThrow(
      "You cannot approve your own submission",
    );
  }
  expect((await api.getMyWallet()).balance).toBe(0);
});
it("creators cannot approve their own claims, and another admin can review them", async () => {
  await api.signIn("lea@example.com");
  const id = await api.createActivity({
    type_id: "walk",
    place_id: "lafontaine",
    starts_at: localToISO(futureDay(1), "15:00"),
    capacity: 6,
    min_people: 2,
  });
  expect((await api.getActivity(id)).creator_id).toBe("lea");
  vi.setSystemTime(new Date("2026-11-24T19:00:00Z"));
  await api.confirmAttendance(id);
  const request = (await api.getActivityReview(id)).requests[0];
  if (!request) throw new Error("Expected submission");
  await expect(api.reviewActivityRequest(request.id, "approved")).rejects.toThrow(
    "You cannot approve your own submission",
  );
  await api.signIn("noa@example.com");
  await expect(api.reviewActivityRequest(request.id, "approved")).rejects.toThrow(
    "Only the event creator or an admin can review",
  );
  await api.signIn("sami@example.com");
  await api.reviewActivityRequest(request.id, "approved");
  expect((await api.getActivityReview(id)).requests[0]?.status).toBe("approved");
});
it("task submissions award nothing until separately approved by the creator", async () => {
  const attendance = await submitBoth();
  for (const request of attendance) await api.reviewActivityRequest(request.id, "approved");
  await api.signIn("lea@example.com");
  expect(await api.completeChallenge("finished-photo", "photo-curiosity")).toBe(0);
  expect((await api.getMyProfile())?.total_points).toBe(30);
  expect((await api.getMyWallet()).balance).toBe(120);
  await api.signIn("noa@example.com");
  const task = (await api.getActivityReview("finished-photo")).requests.find(
    (r) => r.kind === "task",
  );
  if (!task) throw new Error("Expected task");
  expect(await api.reviewActivityRequest(task.id, "approved")).toBe(30);
  expect(await api.reviewActivityRequest(task.id, "approved")).toBe(0);
  await api.signIn("lea@example.com");
  expect((await api.getMyProfile())?.total_points).toBe(60);
  expect((await api.getMyWallet()).balance).toBe(240);
});
it("an admin can approve a task submitted by another participant", async () => {
  for (const request of await submitBoth()) await api.reviewActivityRequest(request.id, "approved");
  await api.signIn("lea@example.com");
  await api.completeChallenge("finished-photo", "photo-curiosity");
  await api.signIn("sami@example.com");
  const task = (await api.getActivityReview("finished-photo")).requests.find(
    (r) => r.kind === "task",
  );
  if (!task) throw new Error("Expected task");
  expect(await api.reviewActivityRequest(task.id, "approved")).toBe(30);
});
it("task approval requires approved attendance, not just a submitted claim", async () => {
  await api.signIn("lea@example.com");
  await api.confirmAttendance("finished-photo");
  await api.completeChallenge("finished-photo", "photo-curiosity");
  await api.signIn("noa@example.com");
  const task = (await api.getActivityReview("finished-photo")).requests.find(
    (r) => r.kind === "task",
  );
  if (!task) throw new Error("Expected task");
  await expect(api.reviewActivityRequest(task.id, "approved")).rejects.toThrow(
    "Approve two attendance submissions before task rewards",
  );
  expect(
    (await api.getActivityReview("finished-photo")).requests.find((r) => r.id === task.id)?.status,
  ).toBe("pending");
});
it("rejected attendance earns nothing and can be resubmitted for review", async () => {
  await api.signIn("lea@example.com");
  await api.confirmAttendance("finished-photo");
  await api.signIn("noa@example.com");
  const request = (await api.getActivityReview("finished-photo")).requests[0];
  if (!request) throw new Error("Expected submission");
  await expect(api.reviewActivityRequest(request.id, "rejected")).rejects.toThrow(
    "Add a reason for rejection",
  );
  await api.reviewActivityRequest(request.id, "rejected", "Could not verify attendance");
  await api.signIn("lea@example.com");
  expect((await api.getMyWallet()).balance).toBe(0);
  expect((await api.getActivityReview("finished-photo")).requests[0]?.reason).toBe(
    "Could not verify attendance",
  );
  await api.confirmAttendance("finished-photo");
  const resubmitted = (await api.getActivityReview("finished-photo")).requests;
  expect(resubmitted).toHaveLength(1);
  expect(resubmitted[0]?.status).toBe("pending");
  expect(resubmitted[0]?.reason).toBeUndefined();
});
it("rejected tasks award no bonus and can be resubmitted", async () => {
  for (const request of await submitBoth()) await api.reviewActivityRequest(request.id, "approved");
  await api.signIn("lea@example.com");
  await api.completeChallenge("finished-photo", "photo-curiosity");
  await api.signIn("noa@example.com");
  const task = (await api.getActivityReview("finished-photo")).requests.find(
    (r) => r.kind === "task",
  );
  if (!task) throw new Error("Expected task");
  await api.reviewActivityRequest(task.id, "rejected", "Task not completed");
  await api.signIn("lea@example.com");
  expect((await api.getMyProfile())?.total_points).toBe(30);
  await api.completeChallenge("finished-photo", "photo-curiosity");
  expect((await api.getActivityChallenges("finished-photo"))[0]?.review_status).toBe("pending");
});
it("new accounts cannot grant themselves admin review rights", async () => {
  await api.signUp("admin@example.com", "Admin");
  expect((await api.getActivityReview("finished-photo")).can_review).toBe(false);
});
