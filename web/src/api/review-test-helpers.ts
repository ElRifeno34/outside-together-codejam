import * as api from "./index";
export async function approvePending(id: string) {
  const current = await api.getMyProfile();
  await api.signIn("noa@example.com");
  const review = await api.getActivityReview(id);
  for (const request of review.requests.filter(
    (r) => r.status === "pending" && r.kind === "attendance" && r.user_id !== "noa",
  )) {
    await api.reviewActivityRequest(request.id, "approved");
  }
  for (const request of review.requests.filter(
    (r) => r.status === "pending" && r.kind === "task" && r.user_id !== "noa",
  )) {
    await api.reviewActivityRequest(request.id, "approved");
  }
  if (current?.id === "lea" || current?.id === "sami" || current?.id === "noa")
    await api.signIn(`${current.id}@example.com`);
}
