// Time-aware labels. The database only knows "joined" / "confirmed" (checked in);
// whether that means "late" or "finished" depends on the clock, so it's decided here.
import { useEffect, useState } from "react";

export type Phase = "upcoming" | "live" | "finished";

/** Where an activity is in time: before its start, during its hour, or after it. */
export function activityPhase(
  a: { starts_at: string; duration_min: number },
  now: number = Date.now(),
): Phase {
  const start = new Date(a.starts_at).getTime();
  const end = start + a.duration_min * 60_000;
  return now < start ? "upcoming" : now < end ? "live" : "finished";
}

export type ParticipationTone = "neutral" | "warning" | "success" | "muted";

/** The label for "my" registration, combining my status with the activity's phase. */
export function participationLabel(
  status: "joined" | "confirmed" | "left",
  a: { starts_at: string; duration_min: number },
  now: number = Date.now(),
): { label: string; tone: ParticipationTone } {
  if (status === "left") return { label: "Left activity", tone: "muted" };
  const phase = activityPhase(a, now);
  if (status === "confirmed")
    return phase === "finished"
      ? { label: "Finished · checked in", tone: "success" }
      : { label: "Checked in", tone: "success" };
  if (phase === "upcoming") return { label: "Joined", tone: "neutral" };
  if (phase === "live") return { label: "Late · check in now", tone: "warning" };
  return { label: "Finished · not checked in", tone: "muted" };
}

/** The current time, refreshed every minute so labels change without a reload. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
