import {
  accounts,
  activityTypes,
  places,
  makeFixtures,
  torontoDate,
  torontoTime,
  localToISO,
  futureDay,
  nextWeekday,
  type ActivityBoardRow,
  type Participant,
  type Profile,
  type PointsEntry,
} from "@/data/fixtures";
import {
  rankingFixtures,
  rankingLocations,
  demoFriendships,
  type RankingScope,
  type RankingEntry,
  type RankingPerson,
} from "@/data/rankings";
import {
  challengesFor,
  demoPeople,
  demoRoles,
  type ChatMessage,
  type ApprovalRequest,
} from "@/data/community";
import { creditsFor, rewardCatalog, type CreditEntry, type RewardPurchase } from "@/data/rewards";
import {
  placeDetails,
  distanceMeters,
  VISIT_RADIUS_METERS,
  type LocationFix,
  type DiscoveryPlace,
  type PlaceVisit,
} from "@/data/place-discovery";
import { supabase, backendMode } from "@/lib/supabase";
import { createSupabaseBackend, visualKind, type ConfirmResult } from "./supabase-backend";
// Supabase mode when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set, demo fixtures otherwise.
// Features the database doesn't store yet (chat, challenges, reviews, rewards, place
// check-ins) keep their in-memory demo behaviour in both modes; see web/README.md.
const remote = supabase ? createSupabaseBackend(supabase) : null;
export { backendMode };
export type { ConfirmResult };
export type BoardFilters = { typeId?: string; date?: string; timeFrom?: string; timeTo?: string };
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
let store = makeFixtures();
let sessionId: string | null = null;
let messages: ChatMessage[] = [];
let requests: ApprovalRequest[] = [];
let credits: CreditEntry[] = [];
let purchases: RewardPurchase[] = [];
let savedPlaces: { user_id: string; place_id: string }[] = [];
let visits: PlaceVisit[] = [];
function awardCredits(user: string, amount: number, niche: number, id: string, label: string) {
  if (!credits.some((e) => e.id === id))
    credits.push({ id, user_id: user, amount: creditsFor(amount, niche), label });
}
function balanceFor(user: string) {
  return credits.filter((e) => e.user_id === user).reduce((sum, e) => sum + e.amount, 0);
}
const wait = () => new Promise<void>((r) => setTimeout(r, 300));
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function requireUser(): string {
  if (!sessionId) throw new Error("Sign in required");
  return sessionId;
}
function rowById(id: string): ActivityBoardRow {
  const row = store.rows.find((a) => a.id === id);
  if (!row) throw new Error("Activity not found");
  return row;
}
function sync(row: ActivityBoardRow) {
  row.joined_count = store.participants.filter(
    (p) => p.activity_id === row.id && p.status !== "left",
  ).length;
  row.available_spots = row.capacity - row.joined_count;
  if (row.status === "open" || row.status === "confirmed")
    row.status = row.joined_count >= row.min_people ? "confirmed" : "open";
}
export async function getBoard(filters: BoardFilters = {}): Promise<ActivityBoardRow[]> {
  if (remote) return remote.getBoard(filters);
  await wait();
  return copy(
    store.rows
      .filter(
        (r) =>
          new Date(r.starts_at) > new Date() &&
          places.some((p) => p.id === r.place_id && p.is_public) &&
          (r.status === "open" || r.status === "confirmed") &&
          (!filters.typeId || r.type_id === filters.typeId) &&
          (!filters.date || torontoDate(r.starts_at) === filters.date) &&
          (!filters.timeFrom || torontoTime(r.starts_at) >= filters.timeFrom) &&
          (!filters.timeTo || torontoTime(r.starts_at) <= filters.timeTo),
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  );
}
export async function getActivity(id: string): Promise<ActivityBoardRow> {
  if (remote) return remote.getActivity(id);
  await wait();
  const r = rowById(id);
  if (!places.some((p) => p.id === r.place_id && p.is_public))
    throw new Error("Activity not found");
  return copy(r);
}
export async function getActivityTypes() {
  if (remote) return remote.getActivityTypes();
  await wait();
  return copy(activityTypes);
}
export async function getPublicPlaces(): Promise<DiscoveryPlace[]> {
  if (remote) return remote.getPublicPlaces();
  await wait();
  return copy(
    places
      .filter((p) => p.is_public)
      .map((p): DiscoveryPlace => ({
        ...p,
        ...(placeDetails[p.id] ?? {
          niche_value: 1,
          highlight: "A public Montréal place.",
          image_type: "walk",
        }),
      })),
  );
}
export async function getMyPlaces() {
  await wait();
  const user = requireUser();
  return copy({
    saved: savedPlaces.filter((p) => p.user_id === user).map((p) => p.place_id),
    visits: visits.filter((v) => v.user_id === user),
  });
}
export async function savePlace(id: string, saved: boolean) {
  await wait();
  const user = requireUser();
  const known = remote ? await remote.getPublicPlaces() : places;
  if (!known.some((p) => p.id === id && p.is_public)) throw new Error("Choose a public place");
  savedPlaces = savedPlaces.filter((p) => !(p.user_id === user && p.place_id === id));
  if (saved) savedPlaces.push({ user_id: user, place_id: id });
}
export async function checkInPlace(id: string, location: LocationFix): Promise<PlaceVisit> {
  await wait();
  const user = requireUser();
  // The database has no place-visit table yet, so check-in rewards can't be stored for real.
  if (remote) throw new Error("Place check-in rewards are not connected to the backend yet");
  const place = places.find((p) => p.id === id && p.is_public);
  if (!place) throw new Error("Choose a public place");
  if (
    ![location.lat, location.lng, location.accuracy, location.timestamp].every(Number.isFinite) ||
    Math.abs(location.lat) > 90 ||
    Math.abs(location.lng) > 180 ||
    location.accuracy < 0
  )
    throw new Error("Location is unavailable");
  if (Date.now() - location.timestamp > 60000 || location.timestamp > Date.now() + 5000)
    throw new Error("Refresh your location before checking in");
  if (location.accuracy > 100)
    throw new Error("Location is not precise enough. Try again outdoors.");
  if (distanceMeters(location, place) > VISIT_RADIUS_METERS)
    throw new Error("Get within 150 m of this place to check in");
  const existing = visits.find((v) => v.user_id === user && v.place_id === id);
  if (existing) return copy(existing);
  const niche = placeDetails[id]?.niche_value ?? 1;
  const points = 10 + 5 * niche;
  const visit = {
    user_id: user,
    place_id: id,
    points,
    credits: creditsFor(points, niche),
    visited_at: new Date().toISOString(),
  };
  visits.push(visit);
  store.points.push({
    id: `visit-${user}-${id}`,
    user_id: user,
    activity_id: `visit-${id}`,
    place_id: id,
    place_name: place.name,
    amount: points,
    created_at: visit.visited_at,
  });
  const profile = store.profiles.find((p) => p.id === user);
  if (profile) profile.total_points += points;
  awardCredits(user, points, niche, `visit-${user}-${id}`, place.name);
  return copy(visit);
}
export async function joinActivity(id: string): Promise<number> {
  if (remote) return remote.joinActivity(id);
  await wait();
  const user = requireUser();
  const row = rowById(id);
  if (new Date(row.starts_at) <= new Date() || row.status === "cancelled" || row.status === "done")
    throw new Error("Registration is closed");
  const existing = store.participants.find((p) => p.activity_id === id && p.user_id === user);
  if (existing && existing.status !== "left") return row.joined_count;
  if (row.available_spots <= 0) throw new Error("Activity is full");
  if (existing) {
    existing.status = "joined";
    existing.joined_at = new Date().toISOString();
  } else
    store.participants.push({
      activity_id: id,
      user_id: user,
      status: "joined",
      joined_at: new Date().toISOString(),
    });
  sync(row);
  return row.joined_count;
}
export async function leaveActivity(id: string): Promise<number> {
  if (remote) return remote.leaveActivity(id);
  await wait();
  const user = requireUser();
  const row = rowById(id);
  if (new Date(row.starts_at) <= new Date()) throw new Error("Registration is closed");
  const p = store.participants.find((p) => p.activity_id === id && p.user_id === user);
  if (p) p.status = "left";
  sync(row);
  return row.joined_count;
}
/**
 * Demo mode: submits an attendance request for creator/admin review and returns 0.
 * Supabase mode: confirm_attendance confirms directly; points unlock at 2 confirmations.
 */
export async function confirmAttendance(id: string): Promise<number | ConfirmResult> {
  if (remote) return remote.confirmAttendance(id);
  await wait();
  const user = requireUser();
  const row = rowById(id);
  const participant = store.participants.find(
    (p) => p.activity_id === id && p.user_id === user && p.status !== "left",
  );
  if (
    Date.now() < new Date(row.starts_at).getTime() + 60 * 60000 ||
    !participant ||
    row.status === "cancelled"
  )
    throw new Error("Activity is not eligible for attendance");
  submitRequest(id, user, "attendance");
  return 0;
}
function submitRequest(
  id: string,
  user: string,
  kind: "attendance" | "task",
  challengeId?: string,
) {
  const existing = requests.find(
    (r) =>
      r.activity_id === id &&
      r.user_id === user &&
      r.kind === kind &&
      r.challenge_id === challengeId,
  );
  if (existing) {
    if (existing.status === "rejected") {
      existing.status = "pending";
      delete existing.reason;
      delete existing.reviewed_by;
    }
    return;
  }
  requests.push({
    id: crypto.randomUUID(),
    activity_id: id,
    user_id: user,
    kind,
    status: "pending",
    ...(challengeId ? { challenge_id: challengeId } : {}),
  });
}
function awardAttendance(row: ActivityBoardRow) {
  const id = row.id;
  const confirmed = store.participants.filter(
    (p) => p.activity_id === id && p.status === "confirmed",
  );
  if (confirmed.length < 2) return;
  row.status = "done";
  const amount = 10 + 5 * row.niche_value;
  confirmed.forEach((p) => {
    if (
      !store.points.some((e) => e.activity_id === id && e.user_id === p.user_id && !e.challenge_id)
    ) {
      store.points.push({
        id: `points-${id}-${p.user_id}`,
        user_id: p.user_id,
        activity_id: id,
        amount,
        created_at: new Date().toISOString(),
      });
      const profile = store.profiles.find((u) => u.id === p.user_id);
      if (profile) profile.total_points += amount;
      awardCredits(
        p.user_id,
        amount,
        row.niche_value,
        `earn-${id}-${p.user_id}`,
        row.activity_name,
      );
    }
  });
}
export async function createActivity(input: Draft & { min_people: number }): Promise<string> {
  if (remote) return remote.createActivity(input);
  await wait();
  const user = requireUser();
  const place = places.find((p) => p.id === input.place_id && p.is_public);
  const type = activityTypes.find((t) => t.id === input.type_id);
  if (!place) throw new Error("Choose a public place");
  if (!type) throw new Error("Choose an activity type");
  if (
    !Number.isFinite(new Date(input.starts_at).getTime()) ||
    new Date(input.starts_at) <= new Date()
  )
    throw new Error("Start time must be in the future");
  if (
    !Number.isInteger(input.capacity) ||
    input.capacity < 2 ||
    !Number.isInteger(input.min_people) ||
    input.min_people < 2 ||
    input.min_people > input.capacity
  )
    throw new Error("Minimum people must be between 2 and capacity");
  const id = `created-${crypto.randomUUID()}`;
  store.rows.push({
    id,
    creator_id: user,
    type_id: type.id,
    activity_name: type.name,
    niche_value: type.niche_value,
    place_id: place.id,
    place_name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    starts_at: input.starts_at,
    duration_min: 60,
    capacity: input.capacity,
    min_people: input.min_people,
    status: "open",
    joined_count: 1,
    available_spots: input.capacity - 1,
  });
  store.participants.push({
    activity_id: id,
    user_id: user,
    status: "joined",
    joined_at: new Date().toISOString(),
  });
  return id;
}
/** Accepts the ai-search Edge Function answer (PlanOff \u00a73.2) if it has the expected shape. */
function parseSearchAnswer(answer: unknown, me: string | null): SearchResult | null {
  if (!answer || typeof answer !== "object" || !remote) return null;
  const a = answer as { status?: unknown; matches?: unknown; draft?: unknown; message?: unknown };
  const message = typeof a.message === "string" ? a.message : "";
  if ((a.status === "match" || a.status === "fallback") && Array.isArray(a.matches)) {
    const matches = remote.mapBoardRows(a.matches, me);
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
export async function aiSearch(text: string): Promise<SearchResult> {
  let assistantFailed = false;
  if (remote) {
    // Real path: the ai-search Edge Function turns the sentence into filters server-side.
    const parsed = parseSearchAnswer(await remote.aiSearch(text), await remote.userId());
    if (parsed) return parsed;
    assistantFailed = true; // not deployed yet or errored: fall back to keyword search below
  } else await wait();
  const types = remote ? await remote.getActivityTypes() : activityTypes;
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const type = [...types]
    .reverse()
    .find((t) =>
      t.keywords.some((k) =>
        normalized.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
      ),
    );
  const board = await getBoard(type ? { typeId: type.id } : {});
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
  if (matches.length && assistantFailed) return { status: "fallback", matches };
  if (matches.length) {
    const first = matches[0];
    return {
      status: "match",
      matches,
      message: first
        ? `Found one at ${new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" }).format(new Date(first.starts_at)).toLowerCase()}, ${first.joined_count} people are in.`
        : "Found a few things you might like.",
    };
  }
  const chosen = type ?? types[0];
  if (!chosen) throw new Error("No activity types available");
  day = day ?? futureDay(1);
  let starts = localToISO(day, exact ?? from ?? "15:00");
  if (new Date(starts) <= new Date()) starts = localToISO(futureDay(1), exact ?? from ?? "15:00");
  let placeId = chosen.id === "basketball" ? "court" : "lafontaine";
  if (remote) {
    // Prefer a public place that suits the activity (e.g. a court for basketball).
    const publicPlaces = await remote.getPublicPlaces();
    const kind = visualKind(chosen.name, chosen.keywords);
    const place = publicPlaces.find((p) => p.image_type === kind) ?? publicPlaces[0];
    if (!place) throw new Error("No public places available");
    placeId = place.id;
  }
  return {
    status: "no_match",
    draft: {
      type_id: chosen.id,
      place_id: placeId,
      starts_at: starts,
      capacity: 6,
    },
    message: "Nothing yet. Create it?",
  };
}
export async function getRandomPlace(previousId?: string) {
  const publicPlaces = await getPublicPlaces();
  const choices = publicPlaces.filter((p) => p.id !== previousId);
  return copy(choices[Math.floor(Math.random() * choices.length)] ?? publicPlaces[0] ?? null);
}
/** Demo mode ignores the password; Supabase mode requires it (email + password auth). */
export async function signIn(email: string, password = ""): Promise<Profile> {
  if (remote) {
    const profile = await remote.signIn(email.trim(), password);
    sessionId = profile.id;
    return profile;
  }
  await wait();
  const p = store.profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
  if (!p) throw new Error("Account not found. Try a demo account or sign up.");
  sessionId = p.id;
  return copy(p);
}
/** Google sign-in through Supabase Auth. Leaves the page; the session is restored on return. */
export async function signInWithGoogle(redirectTo: string): Promise<void> {
  if (!remote) throw new Error("Google sign-in needs the Supabase connection");
  await remote.signInWithGoogle(redirectTo);
}
/** Calls back whenever Supabase signs a user in or out (also after the Google redirect). */
export function onAuthChange(callback: () => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(() => callback());
  return () => data.subscription.unsubscribe();
}
export async function signUp(email: string, displayName: string, password = ""): Promise<Profile> {
  if (remote) {
    if (!email.includes("@") || !displayName.trim())
      throw new Error("Enter your email and display name");
    const profile = await remote.signUp(email.trim(), displayName, password);
    sessionId = profile.id;
    return profile;
  }
  await wait();
  if (!email.includes("@") || !displayName.trim())
    throw new Error("Enter your email and display name");
  if (store.profiles.some((p) => p.email.toLowerCase() === email.toLowerCase()))
    throw new Error("An account with this email already exists");
  const p = { id: crypto.randomUUID(), email, display_name: displayName.trim(), total_points: 0 };
  store.profiles.push(p);
  sessionId = p.id;
  return copy(p);
}
export async function signOut() {
  if (remote) await remote.signOut();
  else await wait();
  sessionId = null;
}
export async function getMyProfile(): Promise<Profile | null> {
  if (remote) {
    const profile = await remote.getMyProfile();
    sessionId = profile?.id ?? null;
    return profile;
  }
  await wait();
  return copy(store.profiles.find((p) => p.id === sessionId) ?? null);
}
export async function getMyPoints(): Promise<PointsEntry[]> {
  if (remote) return remote.getMyPoints();
  await wait();
  const user = requireUser();
  return copy(store.points.filter((p) => p.user_id === user));
}
export async function getMyActivities(): Promise<(Participant & { activity: ActivityBoardRow })[]> {
  if (remote) return remote.getMyActivities();
  await wait();
  const user = requireUser();
  return copy(
    store.participants
      .filter((p) => p.user_id === user)
      .map((p) => ({ ...p, activity: rowById(p.activity_id) })),
  );
}
export async function getDemoAccounts() {
  await wait();
  return copy(accounts);
}
function requireMember(id: string) {
  const user = requireUser();
  const row = rowById(id);
  if (!places.some((p) => p.id === row.place_id && p.is_public))
    throw new Error("Activity not found");
  const participant = store.participants.find(
    (p) => p.activity_id === id && p.user_id === user && p.status !== "left",
  );
  if (!participant) throw new Error("Join this activity first");
  return { user, row, participant };
}
// Chat, niche challenges and the creator review step have no tables in Supabase yet:
// in Supabase mode they stay empty instead of mixing fixture people into real activities.
const notConnected = (feature: string) => new Error(`${feature}: not connected to the backend yet`);
export async function getActivityChallenges(id: string) {
  if (remote) return [];
  const row = await getActivity(id);
  return challengesFor(row.type_id, row.niche_value).map((task) => ({
    ...task,
    completed: requests.some(
      (r) =>
        r.activity_id === id &&
        r.user_id === sessionId &&
        r.challenge_id === task.id &&
        r.status === "approved",
    ),
    review_status:
      requests.find(
        (r) => r.activity_id === id && r.user_id === sessionId && r.challenge_id === task.id,
      )?.status ?? null,
    rejection_reason:
      requests.find(
        (r) => r.activity_id === id && r.user_id === sessionId && r.challenge_id === task.id,
      )?.reason ?? "",
  }));
}
export async function completeChallenge(id: string, challengeId: string): Promise<number> {
  if (remote) throw notConnected("Challenges");
  await wait();
  const { user, row, participant } = requireMember(id);
  const task = challengesFor(row.type_id, row.niche_value).find((t) => t.id === challengeId);
  if (!task) throw new Error("Challenge not found");
  if (
    row.status === "cancelled" ||
    Date.now() < new Date(row.starts_at).getTime() + 60 * 60000 ||
    (!requests.some(
      (r) =>
        r.activity_id === id &&
        r.user_id === user &&
        r.kind === "attendance" &&
        r.status !== "rejected",
    ) &&
      participant.status !== "confirmed")
  )
    throw new Error("Submit your attendance first");
  submitRequest(id, user, "task", challengeId);
  return 0;
}
function canReview(row: ActivityBoardRow, user: string) {
  return row.creator_id === user || demoRoles.some((r) => r.user_id === user && r.role === "admin");
}
export async function getActivityReview(id: string): Promise<{
  can_review: boolean;
  creator_name: string;
  requests: (ApprovalRequest & { display_name: string; title: string })[];
}> {
  // confirm_attendance confirms directly in the database: there is nothing to review.
  if (remote) return { can_review: false, creator_name: "Host", requests: [] };
  await wait();
  const user = requireUser();
  const row = rowById(id);
  if (!places.some((p) => p.id === row.place_id && p.is_public))
    throw new Error("Activity not found");
  const reviewer = canReview(row, user);
  return copy({
    can_review: reviewer,
    creator_name: store.profiles.find((p) => p.id === row.creator_id)?.display_name ?? "Host",
    requests: requests
      .filter((r) => r.activity_id === id && (reviewer || r.user_id === user))
      .map((r) => ({
        ...r,
        display_name: store.profiles.find((p) => p.id === r.user_id)?.display_name ?? "Guest",
        title:
          r.kind === "attendance"
            ? "Attendance"
            : (challengesFor(row.type_id, row.niche_value).find((t) => t.id === r.challenge_id)
                ?.title ?? "Challenge"),
      })),
  });
}
export async function reviewActivityRequest(
  requestId: string,
  decision: "approved" | "rejected",
  reason = "",
) {
  if (remote) throw notConnected("Reviews");
  await wait();
  const user = requireUser();
  const request = requests.find((r) => r.id === requestId);
  if (!request) throw new Error("Request not found");
  const row = rowById(request.activity_id);
  if (!canReview(row, user)) throw new Error("Only the event creator or an admin can review");
  if (request.user_id === user) throw new Error("You cannot approve your own submission");
  if (request.status !== "pending") return 0;
  const participant = store.participants.find(
    (p) => p.activity_id === row.id && p.user_id === request.user_id && p.status !== "left",
  );
  if (
    !participant ||
    row.status === "cancelled" ||
    Date.now() < new Date(row.starts_at).getTime() + 60 * 60000
  )
    throw new Error("Request is not eligible for review");
  if (decision === "rejected") {
    if (!reason.trim()) throw new Error("Add a reason for rejection");
    request.status = "rejected";
    request.reason = reason.trim();
    request.reviewed_by = user;
    return 0;
  }
  if (request.kind === "attendance") {
    request.status = "approved";
    request.reviewed_by = user;
    participant.status = "confirmed";
    awardAttendance(row);
    return 0;
  }
  if (
    participant.status !== "confirmed" ||
    !store.points.some(
      (p) => p.activity_id === row.id && p.user_id === request.user_id && !p.challenge_id,
    )
  )
    throw new Error("Approve two attendance submissions before task rewards");
  const task = challengesFor(row.type_id, row.niche_value).find(
    (t) => t.id === request.challenge_id,
  );
  if (!task) throw new Error("Challenge not found");
  request.status = "approved";
  request.reviewed_by = user;
  if (
    store.points.some(
      (p) =>
        p.activity_id === row.id && p.user_id === request.user_id && p.challenge_id === task.id,
    )
  )
    return 0;
  store.points.push({
    id: `bonus-${row.id}-${request.user_id}-${task.id}`,
    user_id: request.user_id,
    activity_id: row.id,
    challenge_id: task.id,
    challenge_title: task.title,
    amount: task.points,
    created_at: new Date().toISOString(),
  });
  const profile = store.profiles.find((p) => p.id === request.user_id);
  if (profile) profile.total_points += task.points;
  awardCredits(
    request.user_id,
    task.points,
    row.niche_value,
    `earn-${row.id}-${request.user_id}-${task.id}`,
    task.title,
  );
  return task.points;
}
export async function getActivityPeople(id: string) {
  // activity_board deliberately exposes counts, never who is going.
  if (remote) return [];
  await getActivity(id);
  return copy(
    store.participants
      .filter((p) => p.activity_id === id && p.status !== "left")
      .map((p) => {
        const profile = store.profiles.find((u) => u.id === p.user_id);
        const guest = demoPeople[Number(p.user_id.replace("guest-", ""))] ?? demoPeople[0];
        return {
          id: p.user_id,
          name: profile?.display_name ?? guest?.name ?? "Guest",
          bio: profile ? "Here to discover Montréal together." : (guest?.bio ?? ""),
          status: p.status,
        };
      }),
  );
}
export async function getActivityChat(id: string): Promise<ChatMessage[]> {
  if (remote) return [];
  await wait();
  requireMember(id);
  const people = await getActivityPeople(id);
  const welcome = people
    .slice(0, 2)
    .filter((p) => p.id.startsWith("guest-"))
    .map((p, index) => ({
      id: `welcome-${id}-${p.id}`,
      activity_id: id,
      user_id: p.id,
      display_name: p.name,
      body:
        index === 0
          ? "Hi everyone! Excited to meet you outside."
          : "I’ll be near the main entrance. See you there!",
      seeded: true,
    }));
  // Recheck after latency: switching accounts or leaving must not return another member's chat.
  requireMember(id);
  return copy([...welcome, ...messages.filter((m) => m.activity_id === id)]);
}
export async function sendActivityMessage(id: string, body: string): Promise<ChatMessage> {
  if (remote) throw notConnected("Group chat");
  await wait();
  const { user, row } = requireMember(id);
  if (row.status === "cancelled") throw new Error("This conversation is closed");
  const text = body.trim();
  if (!text || text.length > 500) throw new Error("Write a message between 1 and 500 characters");
  const profile = store.profiles.find((p) => p.id === user);
  if (!profile) throw new Error("Sign in required");
  const message = {
    id: crypto.randomUUID(),
    activity_id: id,
    user_id: user,
    display_name: profile.display_name,
    body: text,
    seeded: false,
  };
  messages.push(message);
  return copy(message);
}
export async function getRankingLocations(): Promise<{ cities: string[]; countries: string[] }> {
  await wait();
  return {
    cities: [...new Set(["Montréal", ...rankingFixtures.map((p) => p.city)])],
    countries: [...new Set(["Canada", ...rankingFixtures.map((p) => p.country)])],
  };
}
export async function getRewardCatalog() {
  await wait();
  return copy(rewardCatalog);
}
/**
 * Credit ledger for one account. In Supabase mode, earnings are derived from the real points
 * rows (amount = 10 + 5 × niche, so niche = (amount − 10) / 5); spending stays in memory
 * until the backend gets a ledger table.
 */
async function walletEntries(user: string): Promise<CreditEntry[]> {
  if (!remote) return credits.filter((e) => e.user_id === user);
  const earned = (await remote.getMyPoints()).map((p) => ({
    id: `earn-${p.activity_id}`,
    user_id: user,
    amount: creditsFor(p.amount, Math.max(1, Math.round((p.amount - 10) / 5))),
    label: "Activity",
  }));
  return [...earned, ...credits.filter((e) => e.user_id === user && e.amount < 0)];
}
export async function getMyWallet() {
  if (!remote) await wait();
  const user = requireUser();
  const entries = await walletEntries(user);
  return copy({
    balance: entries.reduce((sum, e) => sum + e.amount, 0),
    entries,
    purchases: purchases.filter((p) => p.user_id === user),
  });
}
export async function purchaseReward(itemId: string): Promise<RewardPurchase> {
  if (!remote) await wait();
  const user = requireUser();
  const item = rewardCatalog.find((r) => r.id === itemId);
  if (!item) throw new Error("Reward not found");
  // Await the ledger first: everything after it runs without yielding, so two concurrent
  // purchases can't both pass the duplicate and balance checks.
  const entries = await walletEntries(user);
  const existing = purchases.find((p) => p.user_id === user && p.item_id === itemId);
  if (existing) return copy(existing);
  const spent = credits
    .filter((e) => e.user_id === user && e.amount < 0 && !entries.includes(e))
    .reduce((sum, e) => sum + e.amount, 0);
  const balance = entries.reduce((sum, e) => sum + e.amount, 0) + spent;
  if (balance < item.cost) throw new Error("Not enough credits");
  const purchase = {
    user_id: user,
    item_id: itemId,
    code: item.kind === "discount" ? `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}` : "",
  };
  credits.push({
    id: `spend-${user}-${itemId}`,
    user_id: user,
    amount: -item.cost,
    label: item.name,
  });
  purchases.push(purchase);
  return copy(purchase);
}
export async function equipReward(kind: "frame" | "badge", itemId: string | null) {
  await wait();
  const user = requireUser();
  if (remote) throw notConnected("Profile customization");
  const profile = store.profiles.find((p) => p.id === user);
  if (!profile) throw new Error("Sign in required");
  if (itemId !== null) {
    const item = rewardCatalog.find((r) => r.id === itemId && r.kind === kind);
    if (!item || !purchases.some((p) => p.user_id === user && p.item_id === itemId))
      throw new Error("Unlock this customization first");
  }
  if (kind === "frame") {
    if (itemId === null) delete profile.avatar_frame;
    else profile.avatar_frame = itemId;
  } else {
    if (itemId === null) delete profile.profile_badge;
    else profile.profile_badge = itemId;
  }
  return copy(profile);
}
export async function getLeaderboard(
  scope: RankingScope = "world",
  location?: string,
): Promise<RankingEntry[]> {
  if (remote) {
    // Real profiles only (public read). No friends or location columns yet: every member counts
    // as Montréal, and "friends" shows just you until a friendships table exists.
    const people = await remote.getLeaderboard();
    if (scope === "friends") {
      const me = requireUser();
      return people.filter((p) => p.id === me).map((p) => ({ ...p, rank: 1 }));
    }
    return people.filter(
      (p) =>
        scope === "world" ||
        (scope === "city" && p.city === (location ?? "Montréal")) ||
        (scope === "country" && p.country === (location ?? "Canada")),
    );
  }
  await wait();
  const user = scope === "friends" ? requireUser() : sessionId;
  const members: RankingPerson[] = store.profiles.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    total_points: p.total_points,
    ...(rankingLocations[p.id] ?? { city: "Montréal", country: "Canada" }),
  }));
  const people = [...members, ...rankingFixtures]
    .filter((p) =>
      scope === "friends"
        ? p.id === user || (user !== null && (demoFriendships[user] ?? []).includes(p.id))
        : scope === "city"
          ? p.city === (location ?? "Montréal")
          : scope === "country"
            ? p.country === (location ?? "Canada")
            : true,
    )
    .sort(
      (a, b) => b.total_points - a.total_points || a.display_name.localeCompare(b.display_name),
    );
  let rank = 0;
  return copy(
    people.map((person, index) => {
      if (index === 0 || people[index - 1]?.total_points !== person.total_points) rank = index + 1;
      return { ...person, rank };
    }),
  );
}
export function resetDemo() {
  store = makeFixtures();
  sessionId = null;
  messages = [];
  requests = [];
  credits = [];
  purchases = [];
  savedPlaces = [];
  visits = [];
}
