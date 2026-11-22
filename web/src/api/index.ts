// The functions the screens call. Every call goes to the Role B Supabase backend
// (supabase-backend.ts, migrations 001–007). Without the Supabase environment variables
// each call throws SupabaseNotConfiguredError; the root route shows a setup screen first.
import { supabase, SupabaseNotConfiguredError } from "@/lib/supabase";
import { futureDay, localToISO, nextWeekday, torontoDate, torontoTime } from "@/lib/time";
import { visualKind } from "@/lib/activity-visuals";
import type {
  ActivityBoardRow,
  ActivityType,
  Participant,
  Place,
  PointsEntry,
  Profile,
} from "@/lib/types";
import {
  createSupabaseBackend,
  type BoardFilters,
  type ConfirmResult,
  type SupabaseBackend,
} from "./supabase-backend";

export type { BoardFilters, ConfirmResult };

/** A prefilled "Start one" form: real type/place ids from the backend. */
export type Draft = {
  type_id: string;
  place_id: string;
  starts_at: string;
  capacity: number;
  min_people?: number;
};

export type SearchResult =
  | { status: "match"; matches: ActivityBoardRow[]; message: string }
  | { status: "no_match"; draft: Draft; message: string }
  | { status: "fallback"; matches: ActivityBoardRow[] };

const remote: SupabaseBackend | null = supabase ? createSupabaseBackend(supabase) : null;

function backend(): SupabaseBackend {
  if (!remote) throw new SupabaseNotConfiguredError();
  return remote;
}

// ---- Board and activities ------------------------------------------------------------

export async function getBoard(filters: BoardFilters = {}): Promise<ActivityBoardRow[]> {
  return backend().getBoard(filters);
}

export async function getActivity(id: string): Promise<ActivityBoardRow> {
  return backend().getActivity(id);
}

export async function getActivityTypes(): Promise<ActivityType[]> {
  return backend().getActivityTypes();
}

export async function getPublicPlaces(): Promise<Place[]> {
  return backend().getPublicPlaces();
}

/** join_activity: returns the new participant count. */
export async function joinActivity(id: string): Promise<number> {
  return backend().joinActivity(id);
}

/** leave_activity: returns the new participant count. */
export async function leaveActivity(id: string): Promise<number> {
  return backend().leaveActivity(id);
}

/** confirm_attendance ("We're here"): points unlock once 2 participants have checked in. */
export async function confirmAttendance(id: string): Promise<ConfirmResult> {
  return backend().confirmAttendance(id);
}

/** create_activity: one hour at a public place; the creator is registered automatically. */
export async function createActivity(input: Draft & { min_people: number }): Promise<string> {
  return backend().createActivity(input);
}

// ---- Search (AI optional) ---------------------------------------------------------------

/** Accepts the ai-search Edge Function answer (PlanOff §3.2) if it has the expected shape. */
function parseSearchAnswer(
  b: SupabaseBackend,
  answer: unknown,
  me: string | null,
): SearchResult | null {
  if (!answer || typeof answer !== "object") return null;
  const a = answer as { status?: unknown; matches?: unknown; draft?: unknown; message?: unknown };
  const message = typeof a.message === "string" ? a.message : "";
  if ((a.status === "match" || a.status === "fallback") && Array.isArray(a.matches)) {
    const matches = b.mapBoardRows(a.matches, me);
    return a.status === "match"
      ? { status: "match", matches, message: message || "Found a few things you might like." }
      : { status: "fallback", matches };
  }
  if (a.status === "no_match" && a.draft && typeof a.draft === "object") {
    const d = a.draft as Partial<Draft>;
    if (d.type_id && d.place_id && d.starts_at)
      return {
        status: "no_match",
        draft: {
          type_id: d.type_id,
          place_id: d.place_id,
          starts_at: d.starts_at,
          capacity: d.capacity ?? 6,
        },
        message: message || "Nothing yet. Create it?",
      };
  }
  return null;
}

const plain = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Sentence search. Uses the ai-search Edge Function when it answers in the expected shape,
 * otherwise a keyword search over the real board (activity, day, part of day, clock time).
 * No match returns a draft for "Start one" with real type and place ids.
 */
export async function aiSearch(text: string): Promise<SearchResult> {
  const b = backend();
  const parsed = parseSearchAnswer(b, await b.aiSearch(text), await b.userId());
  if (parsed) return parsed;

  const types = await b.getActivityTypes();
  const normalized = plain(text);
  const type = [...types]
    .reverse()
    .find((t) => t.keywords.some((k) => normalized.includes(plain(k))));
  const board = await b.getBoard(type ? { typeId: type.id } : {});
  if (/offline|unavailable|fail/.test(normalized)) return { status: "fallback", matches: board };
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const frenchDays = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const weekday = weekdays.findIndex(
    (d, i) => normalized.includes(d) || normalized.includes(frenchDays[i] ?? "never-a-day"),
  );
  let day =
    weekday >= 0
      ? nextWeekday(weekday)
      : /tomorrow|demain/.test(normalized)
        ? futureDay(1)
        : /today|tonight|aujourd|ce soir/.test(normalized)
          ? torontoDate()
          : undefined;
  const from = /afternoon|apres-midi/.test(normalized)
    ? "12:00"
    : /tonight|evening|soir/.test(normalized)
      ? "17:00"
      : /morning|matin/.test(normalized)
        ? "06:00"
        : undefined;
  const to = /afternoon|apres-midi/.test(normalized)
    ? "17:00"
    : /tonight|evening|soir/.test(normalized)
      ? "23:59"
      : /morning|matin/.test(normalized)
        ? "12:00"
        : undefined;
  const clock = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const exact = clock
    ? `${String((Number(clock[1]) % 12) + (clock[3] === "pm" ? 12 : 0)).padStart(2, "0")}:${clock[2] ?? "00"}`
    : undefined;
  const matches = board.filter(
    (r) =>
      (!day || torontoDate(r.starts_at) === day) &&
      (!from || torontoTime(r.starts_at) >= from) &&
      (!to || torontoTime(r.starts_at) <= to) &&
      (!exact || torontoTime(r.starts_at) === exact),
  );
  // The assistant didn't answer in the expected shape, so these are keyword results.
  if (matches.length) return { status: "fallback", matches };

  const chosen = type ?? types[0];
  if (!chosen) throw new Error("No activity types available");
  day = day ?? futureDay(1);
  let starts = localToISO(day, exact ?? from ?? "15:00");
  if (new Date(starts) <= new Date()) starts = localToISO(futureDay(1), exact ?? from ?? "15:00");
  // Prefer a public place that suits the activity (e.g. a court for basketball).
  const places = await b.getPublicPlaces();
  const kind = visualKind(chosen.name, chosen.keywords);
  const place = places.find((p) => visualKind(p.name) === kind) ?? places[0];
  if (!place) throw new Error("No public places available");
  return {
    status: "no_match",
    draft: { type_id: chosen.id, place_id: place.id, starts_at: starts, capacity: 6 },
    message: "Nothing yet. Create it?",
  };
}

// ---- Accounts ---------------------------------------------------------------------------

/** Email + password sign-in through Supabase Auth. */
export async function signIn(email: string, password: string): Promise<Profile> {
  return backend().signIn(email.trim(), password);
}

export async function signUp(
  email: string,
  displayName: string,
  password: string,
): Promise<Profile> {
  if (!email.includes("@") || !displayName.trim())
    throw new Error("Enter your email and display name");
  return backend().signUp(email.trim(), displayName, password);
}

/** Google sign-in through Supabase Auth. Leaves the page; the session is restored on return. */
export async function signInWithGoogle(redirectTo: string): Promise<void> {
  await backend().signInWithGoogle(redirectTo);
}

/** Calls back whenever Supabase signs a user in or out (also after the Google redirect). */
export function onAuthChange(callback: () => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(() => callback());
  return () => data.subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  await backend().signOut();
}

export async function getMyProfile(): Promise<Profile | null> {
  return backend().getMyProfile();
}

export async function getMyPoints(): Promise<PointsEntry[]> {
  return backend().getMyPoints();
}

export async function getMyActivities(): Promise<(Participant & { activity: ActivityBoardRow })[]> {
  return backend().getMyActivities();
}
