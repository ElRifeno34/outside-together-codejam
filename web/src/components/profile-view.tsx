import { useLanguage } from "@/i18n";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Coins, MapPin, MessageCircle, Pin, PinOff, ShoppingBag, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DisplayName, GradeBadge, ProfileAvatar, TrophyBadge } from "@/components/profile-bits";
import { BANNERS, gradeFor, gradeProgress, TROPHY_TIERS } from "@/lib/progression";
import * as api from "@/api";
import { SocialLinksEditor, SocialLinksRow } from "@/components/social-links";

/** Banner, avatar, grade, stats and trophies for one person (mine or someone else's). */
export function ProfileView({ userId }: { userId: string }) {
  const { tr } = useLanguage();
  const client = useQueryClient();
  const person = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => api.getPublicProfile(userId),
  });
  const trophies = useQuery({ queryKey: ["trophies"], queryFn: api.getTrophies });
  const mine = person.data?.is_me ?? false;
  const progress = useQuery({
    queryKey: ["my-progress", userId],
    queryFn: api.getMyProgress,
    enabled: mine,
  });
  const [saving, setSaving] = useState(false);

  if (person.isError) return null; // before migration 019, or an unknown id
  if (!person.data) return <div className="pf-card pf-loading" aria-busy="true" />;
  const p = person.data;
  const grade = gradeFor(p.total_points);
  const earned = new Set(p.trophies);
  const defs = [...(trophies.data ?? [])].sort(
    (a, b) =>
      Number(earned.has(b.id)) - Number(earned.has(a.id)) ||
      TROPHY_TIERS.indexOf(a.tier) - TROPHY_TIERS.indexOf(b.tier) ||
      a.sort - b.sort,
  );
  const showcase = p.showcase
    .map((id) => trophies.data?.find((t) => t.id === id))
    .filter((t) => t !== undefined);

  const toggleShowcase = async (id: string) => {
    const next = p.showcase.includes(id) ? p.showcase.filter((x) => x !== id) : [...p.showcase, id];
    if (next.length > 3) {
      toast.error(tr("You can show up to 3 trophies"));
      return;
    }
    setSaving(true);
    try {
      await api.setShowcase(next);
      await client.invalidateQueries({ queryKey: ["public-profile", userId] });
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pf-view">
      <div className="pf-card pf-card-large">
        <div
          className="pf-banner"
          style={p.banner_item ? { background: BANNERS[p.banner_item] } : undefined}
        />
        <div className="pf-card-body">
          <ProfileAvatar
            name={p.display_name}
            avatarItem={p.avatar_item}
            frameItem={p.frame_item}
            size={96}
          />
          <div className="pf-identity">
            <DisplayName name={p.display_name} effectItem={p.name_effect_item} as="h1" />
            <div className="pf-meta">
              <GradeBadge points={p.total_points} />
              {p.area && (
                <span>
                  <MapPin size={13} /> {p.area}
                </span>
              )}
            </div>
            {p.world_rank !== undefined && (
              <Link to="/rankings" search={{ tab: "world" }} className="pf-rank">
                <Trophy size={14} />
                <strong>#{p.world_rank}</strong> {tr("worldwide")}
                {p.world_total ? <small> / {p.world_total}</small> : null}
                {p.area && p.area_rank ? (
                  <>
                    {" · "}
                    <strong>#{p.area_rank}</strong> {tr("in")} {p.area}
                  </>
                ) : null}
              </Link>
            )}
            {p.links && Object.keys(p.links).length > 0 && <SocialLinksRow links={p.links} />}
            {showcase.length > 0 && (
              <div className="pf-showcase" aria-label={tr("Showcased trophies")}>
                {showcase.map((t) => (
                  <TrophyBadge key={t.id} tier={t.tier} name={t.name} size="sm" />
                ))}
              </div>
            )}
          </div>
          {!mine && (
            <div className="pf-actions">
              <Button asChild variant="outline" size="sm">
                <Link to="/messages" search={{ with: p.id }}>
                  <MessageCircle /> {tr("Message")}
                </Link>
              </Button>
            </div>
          )}
          {mine && (
            <div className="pf-actions">
              <span className="pf-credits">
                <Coins size={16} /> <strong>{progress.data?.credits ?? "…"}</strong> {tr("credits")}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link to="/shop">
                  <ShoppingBag /> {tr("Customize")}
                </Link>
              </Button>
            </div>
          )}
        </div>
        <div className="pf-stats">
          <span>
            <strong>{p.total_points}</strong> {tr("points")}
          </span>
          <span>
            <strong>{p.checkins}</strong> {tr("check-ins")}
          </span>
          <span>
            <strong>{p.places}</strong> {tr("places visited")}
          </span>
          <span>
            <strong>{earned.size}</strong> {tr("trophies")}
          </span>
        </div>
        <div className="pf-grade" aria-label={tr("Grade progress")}>
          <div className="pf-grade-bar" data-metal={grade.metal}>
            <span style={{ width: `${Math.round(gradeProgress(p.total_points) * 100)}%` }} />
          </div>
          <small>
            {grade.next === null
              ? tr("Top grade reached. Respect.")
              : `${grade.next - p.total_points} ${tr("points to the next grade")}`}
          </small>
        </div>
      </div>

      {mine && p.links !== undefined && <SocialLinksEditor current={p.links} userId={userId} />}

      <div className="pf-trophies">
        <h2 className="section-label">
          {tr("Trophies")} · {earned.size}/{defs.length}
        </h2>
        {mine && earned.size > 0 && (
          <p className="pf-hint">{tr("Pin up to 3 trophies to show them next to your name.")}</p>
        )}
        <ul className="trophy-grid">
          {defs.map((t) => (
            <li key={t.id}>
              <TrophyBadge
                tier={t.tier}
                name={t.name}
                description={`${t.description} (+${t.credits} ${tr("credits")})`}
                earned={earned.has(t.id)}
              />
              {mine && earned.has(t.id) && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={saving}
                  aria-label={tr(
                    p.showcase.includes(t.id) ? "Unpin from profile" : "Pin to profile",
                  )}
                  onClick={() => void toggleShowcase(t.id)}
                >
                  {p.showcase.includes(t.id) ? <PinOff /> : <Pin />}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
