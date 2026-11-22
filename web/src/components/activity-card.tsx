import { useLanguage } from "@/i18n";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, Clock3, Sparkles, Check } from "lucide-react";
import { activityIcons, Pictogram } from "./pictogram";
import { NicheLevel } from "./niche-level";
import { visualKey, type ActivityBoardRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useApp } from "./app-provider";
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
export function ActivityCard({
  activity,
  joined = false,
  onChanged,
}: {
  activity: ActivityBoardRow;
  joined?: boolean;
  onChanged?: () => void;
}) {
  const { tr, language } = useLanguage();
  const { profile, openAuth, refreshProfile } = useApp();
  const join = async () => {
    try {
      await joinActivity(activity.id);
      toast.success(
        language === "fr"
          ? `Vous participez à ${tr(activity.activity_name)} !`
          : `You're joining ${activity.activity_name.toLowerCase()}!`,
      );
      await refreshProfile();
      onChanged?.();
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Could not join"));
    }
  };
  return (
    <article className="activity-card">
      <Link to="/activity/$id" params={{ id: activity.id }} className="card-photo-link">
        <img
          src={activityImages[visualKey(activity)]}
          alt={tr(activity.activity_name)}
          className="card-photo"
        />
        <span className={`status-chip ${activity.status === "confirmed" ? "is-confirmed" : ""}`}>
          {activity.status === "confirmed" ? <Check size={12} /> : <span className="status-dot" />}
          {activity.status === "confirmed"
            ? tr("It’s happening")
            : activity.status === "done"
              ? tr("Completed")
              : tr("Open to join")}
        </span>
        <span className="photo-arrow">
          <ArrowUpRight size={19} />
        </span>
      </Link>
      <div className="card-body">
        <div className="card-heading">
          <Link to="/activity/$id" params={{ id: activity.id }}>
            <h3>
              <Pictogram kind={visualKey(activity)} level={activity.niche_value} size={28} />
              {tr(activity.activity_name ?? "")}
            </h3>
          </Link>
          <NicheLevel level={activity.niche_value} />
        </div>
        <div className="card-place">
          <MapPin size={14} />
          <div>
            <p>{tr(activity.place_name ?? "")}</p>
            <span>{activity.address}</span>
          </div>
        </div>
        <div className="card-time">
          <span>
            <Clock3 size={14} />
            {formatStart(activity.starts_at, language)}
          </span>
          <span className="time-duration">{tr("1 h")}</span>
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
            <Sparkles size={14} />
            {tr("+")}
            {10 + 5 * activity.niche_value} {tr("pts")}
          </span>
          <Button
            variant="join"
            onClick={() => (profile ? void join() : openAuth(join))}
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
