import { useLanguage } from "@/i18n";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  MapPin,
  Clock3,
  Footprints,
  Dribbble,
  BookOpen,
  Crown,
  Camera,
  Pencil,
  Sparkles,
  Check,
  Coffee,
  Utensils,
  Bird,
  Leaf,
  Origami,
  AudioLines,
  Compass,
  Sun,
  Flame,
  Zap,
} from "lucide-react";
import type * as React from "react";
import { activityTitle, visualKey, type ActivityBoardRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useApp } from "./app-provider";
import { activityPhase, useNow } from "@/lib/participation";
import { coinPop, confettiBurst } from "@/lib/celebrate";
import { joinActivity } from "@/api";
import { toast } from "sonner";
import walk from "@/assets/walk.jpg";
import basketball from "@/assets/basketball.jpg";
import study from "@/assets/study.jpg";
import chess from "@/assets/chess.jpg";
import photo from "@/assets/photo.jpg";
import sketch from "@/assets/sketch.jpg";
import coffee from "@/assets/coffee.jpg";
import picnic from "@/assets/picnic.jpg";
import bird from "@/assets/bird.jpg";
import sunset from "@/assets/sunset.jpg";
export const activityImages: Record<string, string> = {
  walk,
  basketball,
  study,
  chess,
  photo,
  sketch,
  picnic,
  coffee,
  jog: walk,
  sunset,
  neighbourhood: photo,
  bird,
  geocache: walk,
  origami: sketch,
  moss: walk,
  sound: photo,
};
/** The photo to show: the creator's upload, else the activity type's photo. */
export function activityPhoto(
  row: Pick<ActivityBoardRow, "photo_url" | "type_id" | "kind">,
): string {
  return row.photo_url || activityImages[visualKey(row)] || activityImages["walk"]!;
}

export const activityIcons = {
  walk: Footprints,
  basketball: Dribbble,
  study: BookOpen,
  chess: Crown,
  photo: Camera,
  sketch: Pencil,
  picnic: Utensils,
  coffee: Coffee,
  jog: Footprints,
  sunset: Sun,
  neighbourhood: Compass,
  bird: Bird,
  geocache: Compass,
  origami: Origami,
  moss: Leaf,
  sound: AudioLines,
};
export function formatStart(date: string, language: "en" | "fr" = "en") {
  return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-US", {
    timeZone: "America/Toronto",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: language !== "fr",
  })
    .format(new Date(date))
    .replace(",", "")
    .replace("AM", "am")
    .replace("PM", "pm");
}
/** Lively UI test: niche value 1–5 shown as a game rarity tier. */
export const rarityTiers = [
  { en: "Common", fr: "Commun" },
  { en: "Uncommon", fr: "Peu commun" },
  { en: "Rare", fr: "Rare" },
  { en: "Epic", fr: "Épique" },
  { en: "Legendary", fr: "Légendaire" },
] as const;
export function rarityName(niche: number, language: "en" | "fr") {
  const tier = rarityTiers[Math.min(Math.max(niche, 1), 5) - 1]!;
  return tier[language];
}
/** "in 42 min", "in 3 h 10", or null when it is more than a day away / already started. */
export function countdown(startsAt: string, now: number, language: "en" | "fr") {
  const minutes = Math.round((new Date(startsAt).getTime() - now) / 60_000);
  if (minutes <= 0 || minutes >= 24 * 60) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const span = h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")}`;
  return language === "fr" ? `dans ${span}` : `in ${span}`;
}
function clockParts(date: string, language: "en" | "fr") {
  const d = new Date(date);
  const time = new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-US", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
    hour12: language !== "fr",
  })
    .format(d)
    .replace(/\s?(AM|PM)/, "");
  const ampm =
    language === "fr"
      ? ""
      : new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric" })
          .format(d)
          .slice(-2)
          .toLowerCase();
  const day = new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-US", {
    timeZone: "America/Toronto",
    weekday: "short",
  }).format(d);
  return { time, ampm, day };
}
export function ActivityCard({
  activity,
  joined = false,
  onChanged,
  index = 0,
}: {
  activity: ActivityBoardRow;
  joined?: boolean;
  onChanged?: () => void;
  index?: number;
}) {
  const now = useNow();
  const phase = activityPhase(activity, now);
  const { tr, language } = useLanguage();
  const { profile, openAuth, refreshProfile } = useApp();
  const Icon = activityIcons[visualKey(activity) as keyof typeof activityIcons] ?? Footprints;
  const points = 10 + 5 * activity.niche_value;
  const soon = phase === "upcoming" ? countdown(activity.starts_at, now, language) : null;
  const clock = clockParts(activity.starts_at, language);
  const sticker =
    phase !== "upcoming"
      ? null
      : activity.available_spots === 0
        ? { kind: "full", text: language === "fr" ? "Complet" : "Full" }
        : activity.available_spots <= 2
          ? { kind: "hot", text: language === "fr" ? "Presque complet" : "Almost full" }
          : soon && new Date(activity.starts_at).getTime() - now < 2 * 3600_000
            ? { kind: "soon", text: language === "fr" ? "Bientôt" : "Starting soon" }
            : null;
  const join = async (button?: Element | null) => {
    try {
      await joinActivity(activity.id);
      confettiBurst(button ?? null);
      coinPop(button ?? null, `+${points}`);
      toast.success(
        language === "fr"
          ? `Vous participez à ${tr(activityTitle(activity))} !`
          : `You're joining ${activityTitle(activity)}!`,
      );
      await refreshProfile();
      onChanged?.();
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Could not join"));
    }
  };
  return (
    <article
      className="activity-card"
      data-rarity={Math.min(Math.max(activity.niche_value, 1), 5)}
      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
    >
      <Link to="/activity/$id" params={{ id: activity.id }} className="card-photo-link">
        <img
          src={activityPhoto(activity)}
          alt={tr(activityTitle(activity))}
          className="card-photo"
        />
        <span
          className={`status-chip ${activity.status === "confirmed" && phase !== "finished" ? "is-confirmed" : ""}`}
          data-phase={phase}
        >
          {activity.status === "confirmed" && phase !== "finished" ? (
            <Check size={12} />
          ) : (
            <span className="status-dot" />
          )}
          {phase === "finished"
            ? tr("Finished")
            : phase === "live"
              ? tr("Happening now")
              : activity.status === "confirmed"
                ? tr("It’s happening")
                : activity.status === "done"
                  ? tr("Completed")
                  : tr("Open to join")}
        </span>
        {sticker && (
          <span className="card-sticker" data-kind={sticker.kind}>
            {sticker.kind === "hot" && <Flame size={13} />}
            {sticker.kind === "soon" && <Zap size={13} />}
            {sticker.text}
          </span>
        )}
        <span className="photo-arrow">
          <ArrowUpRight size={19} />
        </span>
        <span className="card-icon-medal" aria-hidden="true">
          <Icon size={26} />
        </span>
      </Link>
      <div className="card-body">
        <div className="card-heading">
          <Link to="/activity/$id" params={{ id: activity.id }}>
            <h3>
              <Icon size={19} />
              {tr(activityTitle(activity))}
            </h3>
          </Link>
          <span
            className="niche-badge"
            title={`${tr("Niche value")} ${activity.niche_value}/5`}
          >
            <Sparkles size={12} />
            {rarityName(activity.niche_value, language)}
          </span>
        </div>
        <div className="card-clock">
          <span className="card-clock-time">
            {clock.time}
            {clock.ampm && <small>{clock.ampm}</small>}
          </span>
          <span className="card-clock-meta">
            <span>{clock.day}</span>
            {soon ? (
              <span className="card-countdown">
                <Clock3 size={12} />
                {soon}
              </span>
            ) : (
              <span>{tr("1 h")}</span>
            )}
          </span>
        </div>
        <div className="card-place">
          <MapPin size={14} />
          <div>
            <p>{tr(activity.place_name ?? "")}</p>
            <span>{activity.address}</span>
          </div>
        </div>
        <div className="card-divider" />
        <div className="card-people">
          <div className="avatars" aria-hidden="true">
            {Array.from({ length: Math.min(activity.joined_count, 3) }, (_, i) => (
              <span key={i} className={`avatar avatar-${i}`}>
                {["L", "S", "N"][i]}
              </span>
            ))}
          </div>
          <div>
            <strong>
              {activity.joined_count} {" / "}
              {activity.capacity} {tr("joined")}
            </strong>
            <span className={activity.available_spots === 1 ? "last-spot" : ""}>
              {activity.available_spots} {activity.available_spots === 1 ? tr("spot") : tr("spots")}{" "}
              {tr("left")}
            </span>
          </div>
        </div>
        <div className="card-bottom">
          <span
            className="points-label card-reward"
            title={tr("Unlocked when 2 participants check in")}
          >
            <span className="coin" aria-hidden="true" />
            {tr("+")}
            {points} {tr("pts")}
          </span>
          <Button
            variant="join"
            onClick={(e) => {
              const button = e.currentTarget;
              if (profile) void join(button);
              else openAuth(() => join(button));
            }}
            disabled={joined || activity.available_spots === 0}
          >
            {joined ? (
              <>
                <Check />
                {tr("Joined")}
              </>
            ) : (
              <>
                {tr("Join activity")}
                <ArrowUpRight />
              </>
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}
