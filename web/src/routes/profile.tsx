import { useLanguage } from "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ArrowLeft, Sparkles, UserRound } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { activityImages, activityPhoto, formatStart } from "@/components/activity-card";
import { participationLabel, useNow } from "@/lib/participation";
import { activityTitle, visualKey } from "@/lib/types";
import * as api from "@/api";
export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My activities & points · Outside Together" },
      {
        name: "description",
        content: "Your one-hour Montréal activities, attendance, and earned points.",
      },
      { property: "og:title", content: "My activities & points · Outside Together" },
      {
        property: "og:description",
        content: "See the good company you’ve kept and points you’ve earned outside.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});
function ProfilePage() {
  const { tr, language } = useLanguage();
  // Re-render every minute so Late / Finished appear without a reload.
  const now = useNow();
  const { profile, openAuth } = useApp();
  const my = useQuery({
    queryKey: ["my-activities", profile?.id],
    queryFn: api.getMyActivities,
    enabled: !!profile,
  });
  const points = useQuery({
    queryKey: ["my-points", profile?.id],
    queryFn: api.getMyPoints,
    enabled: !!profile,
  });
  return (
    <main className="page-width">
      <div className="page-title">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} />
          {tr("Back to activities")}
        </Link>
      </div>
      {!profile ? (
        <div className="empty-state">
          <UserRound size={32} />
          <h1 className="text-2xl font-display font-bold">{tr("Your next chapter is outside.")}</h1>
          <p>{tr("Sign in to see your activities and points.")}</p>
          <Button onClick={() => openAuth()}>
            {tr("Sign in")}
            <ArrowUpRight />
          </Button>
        </div>
      ) : (
        <>
          <section className="profile-summary">
            <div className="profile-person">
              <span className="profile-avatar" aria-hidden="true">
                {profile.display_name.charAt(0)}
              </span>
              <div>
                <h1>
                  {tr("Hey, ")}
                  {profile.display_name}
                  {tr(".")}
                </h1>
                <p>{tr("Here’s your little corner of Outside Together.")}</p>
              </div>
            </div>
            <div className="points-total">
              <strong>{profile.total_points}</strong>
              <span>{tr("total points")}</span>
            </div>
          </section>
          <div className="profile-columns">
            <section>
              <h2 className="section-label">{tr("My activities")}</h2>
              {my.isPending ? (
                <p className="text-sm text-muted-foreground">{tr("Loading your activities…")}</p>
              ) : my.error ? (
                <p role="alert">{tr("Couldn’t load your activities.")}</p>
              ) : my.data?.length ? (
                my.data.map((p) => (
                  <Link
                    key={p.activity_id}
                    to="/activity/$id"
                    params={{ id: p.activity_id }}
                    className="my-activity"
                  >
                    <img src={activityPhoto(p.activity)} alt={tr(activityTitle(p.activity))} />
                    <div>
                      <h3>{tr(activityTitle(p.activity))}</h3>
                      <p>
                        {tr(p.activity.place_name ?? "")} {" · "}
                        {formatStart(p.activity.starts_at, language)}
                      </p>
                      {(() => {
                        const s = participationLabel(p.status, p.activity, now);
                        return (
                          <span className="participant-status" data-tone={s.tone}>
                            {tr(s.label)}
                          </span>
                        );
                      })()}
                    </div>
                    <ArrowUpRight />
                  </Link>
                ))
              ) : (
                <div className="empty-state">
                  <h2>{tr("A little adventure awaits.")}</h2>
                  <p>{tr("Join an activity and it’ll appear here.")}</p>
                  <Button asChild>
                    <Link to="/">
                      {tr("Explore activities")}
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </div>
              )}
            </section>
            <section>
              <h2 className="section-label flex items-center gap-2">
                <Sparkles className="text-points" size={19} />
                {tr("My points")}
              </h2>
              <div className="points-rule">
                {tr("Points = 10 + 5 × niche value, once 2 participants check in")}
              </div>
              {points.data?.length ? (
                points.data.map((p) => (
                  <div className="points-entry" key={p.id}>
                    <span>
                      {tr(
                        my.data?.find((a) => a.activity_id === p.activity_id)?.activity
                          .activity_name ?? "Activity",
                      )}
                      <small className="block text-xs text-muted-foreground mt-1">
                        {new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "America/Toronto",
                        }).format(new Date(p.created_at))}
                      </small>
                    </span>
                    <span>
                      {tr("+")}
                      {p.amount} {tr("pts")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tr("Your points appear once 2 participants check in.")}
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
