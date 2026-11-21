import { useLanguage } from "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ArrowLeft, Sparkles, UserRound } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { activityImages, formatStart } from "@/components/activity-card";
import { ProfileAvatar, ProfileBadge } from "@/components/profile-identity";
import { creditsFor } from "@/data/rewards";
import { visualKey } from "@/data/fixtures";
import "@/components/rewards.css";
import * as api from "@/api";
import { backendMode } from "@/lib/supabase";
const live = backendMode === "supabase";
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
  const wallet = useQuery({
    queryKey: ["wallet", profile?.id],
    queryFn: api.getMyWallet,
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
              <ProfileAvatar name={profile.display_name} frame={profile.avatar_frame} />
              <div>
                <h1>
                  {tr("Hey, ")}
                  {profile.display_name}
                  {tr(".")}
                </h1>
                <ProfileBadge badge={profile.profile_badge} />
                <p>{tr("Here’s your little corner of Outside Together.")}</p>
              </div>
            </div>
            <div className="profile-wallet-totals">
              <div className="points-total">
                <strong>{profile.total_points}</strong>
                <span>{tr("total points")}</span>
              </div>
              <div className="points-total">
                <strong>{wallet.data?.balance ?? "…"}</strong>
                <span>{tr("available credits")}</span>
                <Link className="profile-wallet-link" to="/rewards">
                  {tr("Personalize & spend")}
                  <ArrowUpRight size={13} />
                </Link>
              </div>
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
                    <img
                      src={activityImages[visualKey(p.activity)]}
                      alt={tr(p.activity.activity_name ?? "")}
                    />
                    <div>
                      <h3>{tr(p.activity.activity_name ?? "")}</h3>
                      <p>
                        {tr(p.activity.place_name ?? "")} {" · "}
                        {formatStart(p.activity.starts_at, language)}
                      </p>
                      <span className="participant-status">
                        {tr(
                          p.status === "joined"
                            ? "Joined"
                            : p.status === "left"
                              ? "Left activity"
                              : "Checked in",
                        )}
                      </span>
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
                        p.place_name ??
                          my.data?.find((a) => a.activity_id === p.activity_id)?.activity
                            .activity_name ??
                          "Activity",
                      )}
                      {p.challenge_title && (
                        <small className="block text-xs text-points mt-1">
                          {tr("Challenge bonus")} · {tr(p.challenge_title)}
                        </small>
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
                      <small className="credit-earned">
                        +
                        {wallet.data?.entries.find(
                          (e) =>
                            e.id ===
                            (p.place_id
                              ? `visit-${profile.id}-${p.place_id}`
                              : p.challenge_id
                                ? `earn-${p.activity_id}-${profile.id}-${p.challenge_id}`
                                : `earn-${p.activity_id}-${profile.id}`),
                        )?.amount ??
                          creditsFor(
                            p.amount,
                            my.data?.find((a) => a.activity_id === p.activity_id)?.activity
                              .niche_value ?? 1,
                          )}{" "}
                        {tr("credits earned")}
                      </small>
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tr("Your points and credits appear once 2 participants check in.")}
                </p>
              )}
              {/* Links to fixture-only activities: they don't exist in the real database. */}
              {!live && (
                <div className="demo-finished">
                  <h3 className="text-sm font-semibold mb-2">{tr("Past activities")}</h3>
                  <p>
                    {tr(
                      "Léa and Sami can submit past attendance. Noa is the host; Sami is a demo admin.",
                    )}
                  </p>
                  <div className="flex flex-col items-start gap-2">
                    <Button variant="link" asChild>
                      <Link to="/activity/$id" params={{ id: "finished-basketball" }}>
                        {tr("Basketball · 15 pts")}
                        <ArrowUpRight />
                      </Link>
                    </Button>
                    <Button variant="link" asChild>
                      <Link to="/activity/$id" params={{ id: "finished-photo" }}>
                        {tr("Photo walk · 30 pts")}
                        <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
