// Montréal (America/Toronto) date and time helpers. Activities are stored in UTC;
// every day/time the person sees or types is Montréal local time.

/** The Montréal calendar day of a moment, as YYYY-MM-DD. */
export function torontoDate(date: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)?.value ?? "")
    .join("-");
}

/** The Montréal wall-clock time of a moment, as HH:MM (24 h). */
export function torontoTime(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
}

/** A Montréal day (YYYY-MM-DD) and time (HH:MM) as a UTC ISO timestamp. */
export function localToISO(day: string, time: string): string {
  const base = new Date(`${day}T${time}:00Z`);
  if (!Number.isFinite(base.getTime())) throw new Error("Choose a valid date and time");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    timeZoneName: "longOffset",
  }).formatToParts(base);
  const offset = parts.find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return new Date(`${day}T${time}:00${offset}`).toISOString();
}

/** The Montréal day `offset` days from now, as YYYY-MM-DD. */
export function futureDay(offset: number, now = new Date()): string {
  const day = new Date(`${torontoDate(now)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

/** The next Montréal date for a weekday (0 = Sunday); today only if 15:00 hasn't passed. */
export function nextWeekday(index: number, now = new Date()): string {
  const today = new Date(`${torontoDate(now)}T12:00:00Z`);
  let delta = (index - today.getUTCDay() + 7) % 7;
  if (delta === 0 && new Date(localToISO(torontoDate(now), "15:00")) <= now) delta = 7;
  return futureDay(delta, now);
}
