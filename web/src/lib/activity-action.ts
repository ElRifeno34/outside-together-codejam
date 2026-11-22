// The one primary action on an activity page, derived from the same conditions the page
// used before the redesign (Checkpoint 1/2): join before the start, leave before the start,
// self check-in ("We're here") from starts_at, nothing to do once it has departed.

export type ActionState =
  /** Not registered, before the start, spots left. */
  | "join"
  /** Not registered, before the start, no spots left. */
  | "full"
  /** Activity was cancelled. */
  | "cancelled"
  /** Registered, before the start: "You're in" with a quiet Leave. */
  | "registered"
  /** Not registered, started but not over: registration is closed. */
  | "closed"
  /** Registered and started (or over), not yet checked in: "We're here". */
  | "check-in"
  /** Checked in, points not unlocked yet: waiting for one more check-in. */
  | "waiting"
  /** Checked in and the activity is done: points earned. */
  | "earned"
  /** Not registered and the hour is over. */
  | "departed";

export type ActionInput = {
  joined: boolean;
  checkedIn: boolean;
  /** now >= starts_at */
  started: boolean;
  /** now >= starts_at + 60 min */
  ended: boolean;
  availableSpots: number;
  status: "open" | "confirmed" | "done" | "cancelled";
};

export function actionState(i: ActionInput): ActionState {
  if (i.started && i.joined) {
    if (!i.checkedIn) return "check-in";
    return i.status === "done" ? "earned" : "waiting";
  }
  if (i.ended) return "departed";
  if (i.started) return "closed";
  if (i.joined) return "registered";
  if (i.status === "cancelled") return "cancelled";
  return i.availableSpots <= 0 ? "full" : "join";
}
