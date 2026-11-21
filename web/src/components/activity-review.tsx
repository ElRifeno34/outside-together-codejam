import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import type { ActivityBoardRow } from "@/data/fixtures";
import * as api from "@/api";
import { toast } from "sonner";
import "./activity-review.css";

export function ActivityReview({ activity }: { activity: ActivityBoardRow }) {
  const { profile, refreshProfile } = useApp();
  const { tr } = useLanguage();
  const review = useQuery({
    queryKey: ["activity-review", activity.id, profile?.id],
    queryFn: () => api.getActivityReview(activity.id),
    enabled: !!profile,
  });
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  if (!profile || !review.data?.can_review) return null;
  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      await api.reviewActivityRequest(id, decision, reason);
      setRejecting(null);
      setReason("");
      await refreshProfile();
      toast.success(tr(decision === "approved" ? "Submission approved" : "Submission rejected"));
    } catch (err) {
      toast.error(tr(err instanceof Error ? err.message : "Please try again"));
    } finally {
      setBusy(false);
    }
  };
  const rows = review.data.requests;
  return (
    <section className="activity-review" aria-label={tr("Attendance & task approvals")}>
      <div className="review-heading">
        <h2>
          <ShieldCheck size={22} />
          {tr("Attendance & task approvals")}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          title={tr("Refresh approvals")}
          aria-label={tr("Refresh approvals")}
          disabled={review.isFetching}
          onClick={() => void review.refetch()}
        >
          <RefreshCw />
        </Button>
      </div>
      <p className="review-caption">
        {tr("Host")}: {review.data.creator_name} ·{" "}
        {tr(
          "Two approved attendances unlock activity rewards. Task rewards need separate approval.",
        )}
      </p>
      {review.error && <p role="alert">{tr("Couldn’t load approvals.")}</p>}
      {rows.length ? (
        rows.map((request) => {
          const self = request.user_id === profile.id;
          const taskBlocked = request.kind === "task" && activity.status !== "done";
          return (
            <article
              className="review-request"
              key={request.id}
              aria-label={`${request.display_name} · ${tr(request.title)}`}
            >
              <div>
                <h3>
                  {request.display_name} {self && <small>· {tr("You")}</small>}
                </h3>
                <p>{tr(request.title)}</p>
                <span className="review-status" data-status={request.status}>
                  {tr(
                    request.status === "pending"
                      ? "Awaiting approval"
                      : request.status === "approved"
                        ? "Approved"
                        : "Rejected",
                  )}
                </span>
                {request.reason && <p className="review-reason">{request.reason}</p>}
              </div>
              {request.status === "pending" &&
                (self ? (
                  <p className="review-caption">
                    {tr("Another creator or admin must review your submission.")}
                  </p>
                ) : (
                  <div className="review-actions">
                    <Button
                      variant="secondary"
                      disabled={busy || taskBlocked}
                      onClick={() => void decide(request.id, "approved")}
                    >
                      <Check />
                      {tr("Approve")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setRejecting(request.id);
                        setReason("");
                      }}
                    >
                      <X />
                      {tr("Reject")}
                    </Button>
                    {taskBlocked && (
                      <p className="review-caption">
                        {tr("Approve two attendance submissions before task rewards")}
                      </p>
                    )}
                  </div>
                ))}
              {rejecting === request.id && (
                <form
                  className="review-reject-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void decide(request.id, "rejected");
                  }}
                >
                  <label className="field">
                    {tr("Reason for rejection")}
                    <input
                      required
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="review-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setRejecting(null)}
                    >
                      {tr("Cancel")}
                    </Button>
                    <Button type="submit" disabled={busy || !reason.trim()}>
                      {tr("Confirm rejection")}
                    </Button>
                  </div>
                </form>
              )}
            </article>
          );
        })
      ) : (
        <p className="review-caption">{tr("No submissions to review yet.")}</p>
      )}
    </section>
  );
}
