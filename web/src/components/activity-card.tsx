// Activity photos (detail-page hero, Start one preview) and the shared start-time formatter.
// The Explore timetable uses pictograms instead (components/departure-row.tsx).
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
