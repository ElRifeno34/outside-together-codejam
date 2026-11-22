import { useLanguage } from "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Coins, Gift, Lock, Shield, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { DisplayName, ProfileAvatar } from "@/components/profile-bits";
import { BANNERS } from "@/lib/progression";
import type { SeasonReward } from "@/lib/types";
import * as api from "@/api";
import { Stagger, StaggerItem } from "@/components/motion";
import { celebrate } from "@/lib/celebrate";

export const Route = createFileRoute("/season")({
  head: () => ({
    meta: [
      { title: "Season pass · Outside Together" },
      { name: "description", content: "Earn points this season to unlock 20 tiers of rewards." },
    ],
  }),
  component: SeasonPage,
});

function SeasonPage() {
  const { tr, language } = useLanguage();
  const { profile, openAuth } = useApp();
  const client = useQueryClient();
  const season = useQuery({
    queryKey: ["season", profile?.id],
    queryFn: api.getSeason,
    retry: false,
  });
  const [busy, setBusy] = useState<number | null>(null);

  const claim = async (r: SeasonReward) => {
    if (!profile) return openAuth();
    setBusy(r.tier);
    try {
      await api.claimSeasonReward(r.tier);
      celebrate("season");
      toast.success(
        r.item_id
          ? `${tr("Unlocked:")} ${tr(r.item_name ?? "")}${r.credits ? ` + ${r.credits} ${tr("credits")}` : ""}`
          : `+${r.credits} ${tr("credits")}`,
      );
      await Promise.all([
        client.invalidateQueries({ queryKey: ["season"] }),
        client.invalidateQueries({ queryKey: ["my-progress"] }),
      ]);
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setBusy(null);
    }
  };

  if (season.isError)
    return (
      <main className="page-width">
        <div className="empty-state">
          <h2>{tr("The season pass isn't set up yet.")}</h2>
          <p>{tr("Run migration 020 in Supabase, then reload.")}</p>
        </div>
      </main>
    );
  const s = season.data;
  if (season.isLoading)
    return (
      <main className="page-width season-page" aria-busy="true">
        <p className="chat-empty">{tr("Loading the season…")}</p>
      </main>
    );
  if (!s)
    return (
      <main className="page-width">
        <div className="empty-state">
          <Snowflake size={30} />
          <h2>{tr("No season right now.")}</h2>
          <p>{tr("The next one starts soon. Your points still count for rankings.")}</p>
        </div>
      </main>
    );

  const claimed = new Set(s.claimed);
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(s.ends_at).getTime() - Date.now()) / 86_400_000),
  );
  const nextTier = Math.min(20, s.tier + 1);
  const intoTier = s.points - s.tier * s.points_per_tier;
  const ready = s.rewards.filter((r) => r.tier <= s.tier && !claimed.has(r.tier)).length;
  const endDate = new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
    month: "long",
    day: "numeric",
  }).format(new Date(s.ends_at));

  return (
    <main className="page-width season-page">
      <div className="season-hero" data-theme="habs">
        <div>
          <div className="eyebrow">
            <Shield size={15} /> {tr("Season pass")} · {tr("Hockey night in Montréal")}
          </div>
          <h1>{tr(s.name)}</h1>
          <p>
            {tr(
              "Every point you earn this season moves you up, like goals on the board. 20 tiers, free for everyone. Go Habs Go!",
            )}{" "}
            {tr("Ends")} {endDate} · {daysLeft} {tr(daysLeft === 1 ? "day left" : "days left")}
          </p>
        </div>
        <div className="season-level" aria-label={tr("Your tier")}>
          <strong>{s.tier}</strong>
          <span>/ 20</span>
        </div>
      </div>

      <div className="season-progress">
        <div className="season-bar">
          <span
            style={{ width: `${Math.min(100, (s.points / (20 * s.points_per_tier)) * 100)}%` }}
          />
        </div>
        <p>
          <strong>{s.points}</strong> {tr("season points")}
          {s.tier < 20 && (
            <>
              {" · "}
              {s.points_per_tier - intoTier} {tr("to tier")} {nextTier}
            </>
          )}
          {ready > 0 && (
            <span className="season-ready">
              <Gift size={14} /> {ready} {tr(ready === 1 ? "reward to claim" : "rewards to claim")}
            </span>
          )}
        </p>
        {!profile && (
          <Button onClick={() => openAuth()}>{tr("Sign in to track your season")}</Button>
        )}
      </div>

      <Stagger as="ol" className="season-track">
        {s.rewards.map((r) => {
          const unlocked = r.tier <= s.tier;
          const done = claimed.has(r.tier);
          return (
            <StaggerItem
              as="li"
              key={r.tier}
              data-unlocked={unlocked}
              data-claimed={done}
              data-item={!!r.item_id}
            >
              <span className="season-tier">{r.tier}</span>
              <div className="season-reward">
                <RewardPreview reward={r} name={profile?.display_name ?? "You"} />
                <span className="season-reward-name">
                  {r.item_id ? tr(r.item_name ?? "") : `${r.credits} ${tr("credits")}`}
                  {r.item_id && r.credits > 0 && (
                    <small>
                      + {r.credits} {tr("credits")}
                    </small>
                  )}
                </span>
              </div>
              {done ? (
                <span className="season-claimed">
                  <Check size={15} /> {tr("Claimed")}
                </span>
              ) : unlocked && profile ? (
                <Button size="sm" disabled={busy !== null} onClick={() => void claim(r)}>
                  <Gift /> {tr("Claim")}
                </Button>
              ) : (
                <span className="season-locked">
                  <Lock size={14} /> {r.tier * s.points_per_tier} {tr("pts")}
                </span>
              )}
            </StaggerItem>
          );
        })}
      </Stagger>
      <p className="season-foot">
        {tr("Season items can't be bought. Use them from the")} <Link to="/shop">{tr("shop")}</Link>{" "}
        {tr("once claimed.")}
      </p>
    </main>
  );
}

function RewardPreview({ reward, name }: { reward: SeasonReward; name: string }) {
  if (reward.item_kind === "avatar")
    return <ProfileAvatar name={name} avatarItem={reward.item_id} size={40} />;
  if (reward.item_kind === "frame")
    return <ProfileAvatar name={name} frameItem={reward.item_id} size={40} />;
  if (reward.item_kind === "banner")
    return <span className="season-swatch" style={{ background: BANNERS[reward.item_id ?? ""] }} />;
  if (reward.item_kind === "name_effect")
    return (
      <DisplayName name={name.split(" ")[0] ?? name} effectItem={reward.item_id} as="strong" />
    );
  return (
    <span className="season-coin">
      <Coins size={18} />
    </span>
  );
}
