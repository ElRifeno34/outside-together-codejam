// The functions the screens call. Every call goes to the Role B Supabase backend
// (supabase-backend.ts, migrations 001–007). Without the Supabase environment variables
// each call throws SupabaseNotConfiguredError; the root route shows a setup screen first.
import { supabase, SupabaseNotConfiguredError } from "@/lib/supabase";
import type { DevicePosition } from "@/lib/geo";
import { futureDay, localToISO, nextWeekday, torontoDate, torontoTime } from "@/lib/time";
import { visualKind } from "@/lib/activity-visuals";
import type {
  ActivityBoardRow,
  ActivityType,
  Participant,
  Place,
  PointsEntry,
  Profile,
  ActivityQuest,
  Area,
  LeaderboardRow,
  QuestBoardRow,
  QuestDraft,
  QuestTemplate,
  RankingScope,
  Spot,
  SpotVisit,
} from "@/lib/types";
import {
  createSupabaseBackend,
  type BoardFilters,
  type ConfirmResult,
  type SupabaseBackend,
  type ActivityInput,
  type ActivityLocation,
} from "./supabase-backend";

export type { ActivityInput, ActivityLocation, BoardFilters, ConfirmResult };

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

/** confirm_attendance ("We're here"): needs the device within 200 m of the place; points unlock once 2 participants have checked in. */
export async function confirmAttendance(id: string, at: DevicePosition): Promise<ConfirmResult> {
  return backend().confirmAttendance(id, at);
}

/** create_activity: one hour at a public place; the creator is registered automatically. */
export async function createActivity(input: ActivityInput): Promise<string> {
  return backend().createActivity(input);
}

/** update_activity: the creator edits their activity before it starts (migration 009). */
export async function updateActivity(id: string, input: ActivityInput): Promise<void> {
  return backend().updateActivity(id, input);
}

/** delete_activity: the creator removes their activity before it starts (migration 016). */
export async function deleteActivity(id: string): Promise<{ others_removed: number }> {
  return backend().deleteActivity(id);
}

/**
 * Shrinks a photo in the browser (longest side 1600 px, WebP) and uploads it to the
 * activity-photos bucket. Re-encoding also drops the camera's EXIF data (incl. GPS).
 * Returns the storage path to pass as photo_path.
 */
export async function uploadActivityPhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error("Choose a JPG, PNG or WebP photo");
  if (file.size > 15 * 1024 * 1024) throw new Error("That photo is too large (max 15 MB)");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("Couldn't read that photo");
  return backend().uploadActivityPhoto(blob, "webp");
}

/** Public URL of an uploaded activity photo. */
export function activityPhotoUrl(path: string): string {
  return backend().photoUrl(path);
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

/** Filler words ignored by the keyword search (EN + FR). */
const STOP_WORDS = new Set(
  "a an and the to of in on at for with some something anything do want like feel go play "
    .concat("me my i we us people someone friends find any near around this next ")
    .concat("un une des le la les du de et a au aux pour avec quelque chose faire envie jouer ")
    .concat("je moi nous on ce cette prochain pres autour dans")
    .split(" ")
    .filter(Boolean),
);

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
  const words = normalized.split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  // A query word names a keyword when they're equal or one starts the other (≥4 letters),
  // so "birdwatching" finds "birdwatch" but "art" doesn't hide inside "start".
  const sameWord = (w: string, k: string) =>
    w === k || (w.length >= 4 && k.length >= 4 && (w.startsWith(k) || k.startsWith(w)));
  const typeWords = (t: ActivityType) => [
    ...plain(t.name).split(/[^a-z0-9]+/),
    ...t.keywords.flatMap((k) => plain(k).split(/[^a-z0-9]+/)),
  ];
  let type: ActivityType | undefined;
  let typeScore = 0;
  for (const t of types) {
    const vocab = typeWords(t).filter((k) => k.length > 1 && !STOP_WORDS.has(k));
    const score = words.filter((w) => vocab.some((k) => sameWord(w, k))).length;
    if (score > typeScore) [type, typeScore] = [t, score];
  }
  const all = await b.getBoard();
  if (/offline|unavailable|fail/.test(normalized)) return { status: "fallback", matches: all };
  const board = type ? all.filter((r) => r.type_id === type.id) : all;
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
  // Words that aren't the activity, a time or filler may name a place ("Mont-Royal", "Laurier").
  const vocab = type ? typeWords(type) : [];
  const timeWords =
    /^(\d{1,2}(am|pm)?|am|pm|today|tonight|tomorrow|morning|afternoon|evening|aujourd|hui|demain|soir|matin|apres|midi|sunday|monday|tuesday|wednesday|thursday|friday|saturday|dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)$/;
  const rest = words.filter(
    (w) => !STOP_WORDS.has(w) && !timeWords.test(w) && !vocab.some((k) => sameWord(w, k)),
  );
  const placeText = (r: ActivityBoardRow) => plain(`${r.place_name} ${r.address}`);
  const placeWords = rest.filter((w) => w.length >= 3 && all.some((r) => placeText(r).includes(w)));
  // Something was typed but none of it is an activity, place or time: say so instead of
  // pretending every activity matches.
  if (rest.length && !placeWords.length && !type && !day && !from && !exact)
    return {
      status: "match",
      matches: [],
      message: "Nothing matches that yet. Try an activity, a place or a day.",
    };
  const matches = board.filter(
    (r) =>
      placeWords.every((w) => placeText(r).includes(w)) &&
      (!day || torontoDate(r.starts_at) === day) &&
      (!from || torontoTime(r.starts_at) >= from) &&
      (!to || torontoTime(r.starts_at) <= to) &&
      (!exact || torontoTime(r.starts_at) === exact),
  );
  if (matches.length)
    return { status: "match", matches, message: "Here's what matches your search" };
  if (placeWords.length && !type)
    return {
      status: "match",
      matches: [],
      message: "Nothing planned there yet. Try another place or day.",
    };

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

// ---- Accounts (Google only) ----------------------------------------------------------------

const RETURN_KEY = "ot:return-to";

/**
 * Google sign-in through Supabase Auth. Leaves the page.
 *
 * Supabase only redirects back to URLs on its allow list and otherwise falls back to the
 * project's Site URL, where the PKCE code can't be exchanged (the verifier lives in this
 * origin's storage), so the person lands signed out. Returning to the bare origin matches
 * a plain "http://host:port" entry; the page they were on is restored by takeReturnPath().
 */
export async function signInWithGoogle(currentUrl: string): Promise<void> {
  const url = new URL(currentUrl);
  try {
    sessionStorage.setItem(RETURN_KEY, url.pathname + url.search);
  } catch {
    // Private mode or blocked storage: they simply land on the home page.
  }
  await backend().signInWithGoogle(`${url.origin}/`);
}

/** The in-app path saved before the Google redirect (once), or null. */
export function takeReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return path && path.startsWith("/") && !path.startsWith("//") ? path : null;
  } catch {
    return null;
  }
}

const AUTH_ERROR_KEYS = ["error", "error_code", "error_description"];

/**
 * When Supabase refuses a sign-in it redirects back with ?error_description=… (or in the
 * #hash). Returns a sentence to show (once) and removes those parameters from the address.
 * "Database error saving new user" is our own refusal from migrations 011/012: with Google
 * as the only provider, that means the email already had an account.
 */
export function takeSignInError(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const description = url.searchParams.get("error_description") ?? hash.get("error_description");
  if (description === null) return null;
  for (const key of AUTH_ERROR_KEYS) {
    url.searchParams.delete(key);
    hash.delete(key);
  }
  url.hash = hash.toString();
  window.history.replaceState(window.history.state, "", url.toString());
  return /database error saving new user/i.test(description)
    ? "This email already had an Outside Together account, so it can’t create a new one."
    : "Google sign-in didn’t work. Please try again.";
}

/** Calls back whenever Supabase signs a user in or out (also after the Google redirect). */
export function onAuthChange(callback: (event: string) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => callback(event));
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

// ---- Places to visit, rankings and friends (migration 013) -------------------------------

/** The catalogue of places to visit (independent of activities). */
export async function getSpots(): Promise<Spot[]> {
  return backend().getSpots();
}

/** The signed-in person's visits (empty when signed out). */
export async function getMyVisits(): Promise<SpotVisit[]> {
  return backend().getMyVisits();
}

/** visit_spot: within 200 m, 10 + 5 × niche points, once per place. */
export async function visitSpot(id: string, at: DevicePosition) {
  return backend().visitSpot(id, at);
}

export async function getAreas(): Promise<Area[]> {
  return backend().getAreas();
}

export async function getMyArea(): Promise<string | null> {
  return backend().getMyArea();
}

export async function setMyArea(area: string | null): Promise<void> {
  return backend().setMyArea(area);
}

export async function getLeaderboard(
  scope: RankingScope,
  area?: string | null,
): Promise<LeaderboardRow[]> {
  return backend().getLeaderboard(scope, area);
}

export async function getMyFriendCode(): Promise<string> {
  return backend().getMyFriendCode();
}

export async function addFriend(code: string) {
  return backend().addFriend(code);
}

export async function removeFriend(friendId: string): Promise<void> {
  return backend().removeFriend(friendId);
}

// ---- Side quests (migration 017) ------------------------------------------------------------

export async function getQuestTemplates(): Promise<QuestTemplate[]> {
  return backend().getQuestTemplates();
}

export async function getActivityQuests(activityId: string): Promise<ActivityQuest[]> {
  return backend().getActivityQuests(activityId);
}

export async function getMyQuestCompletions() {
  return backend().getMyQuestCompletions();
}

/** Replaces the activity's side quests (creator, before the start; up to 5). */
export async function setActivityQuests(activityId: string, quests: QuestDraft[]): Promise<void> {
  return backend().setActivityQuests(activityId, quests);
}

/** The creator's grid: attendees and the quests already validated for each. */
export async function getQuestBoard(activityId: string): Promise<QuestBoardRow[]> {
  return backend().getQuestBoard(activityId);
}

/** The creator ticks (or unticks) an attendee's side quest: 5 × niche points. */
export async function validateQuest(questId: string, userId: string, done: boolean) {
  return backend().validateQuest(questId, userId, done);
}
