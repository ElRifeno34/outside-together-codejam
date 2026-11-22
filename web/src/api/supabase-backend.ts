// Real implementations of the core API on top of the Supabase contract in docs/BACKEND.md.
// src/api/index.ts is the thin layer the screens call; it builds this from src/lib/supabase.ts.
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { torontoDate, torontoTime } from "@/lib/time";
import { visualKind } from "@/lib/activity-visuals";
import type {
  ActivityBoardRow,
  ActivityType,
  Participant,
  Place,
  PointsEntry,
  Profile,
} from "@/lib/types";

/** Row shape of the public.activity_board view (migration 007). */
type BoardViewRow = {
  id: string;
  type_id: string;
  activity_name: string;
  niche_value: number;
  keywords: string[] | null;
  points_value: number;
  place_id: string;
  place_name: string;
  place_address: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  capacity: number;
  min_people: number;
  status: "open" | "done" | "cancelled";
  is_mine: boolean | null;
  participant_count: number;
  spots_left: number;
  is_full: boolean;
  my_status: "joined" | "confirmed" | null;
};

export type BoardFilters = { typeId?: string; date?: string; timeFrom?: string; timeTo?: string };

export type ConfirmResult = {
  points_earned: number;
  points_unlocked: boolean;
  waiting_for: number;
  total_points: number;
};

/** Backend error codes → the sentences the screens already translate. */
const errorText: Record<string, string> = {
  NOT_AUTHENTICATED: "Sign in required",
  ACTIVITY_NOT_FOUND: "This activity no longer exists",
  ACTIVITY_CLOSED: "This activity is finished or cancelled",
  ACTIVITY_STARTED: "Registration is closed",
  ACTIVITY_NOT_STARTED: "You can confirm once the activity has started",
  ALREADY_JOINED: "You're already in",
  ACTIVITY_FULL: "Activity is full",
  NOT_A_PARTICIPANT: "You haven't joined this activity",
  INVALID_TYPE: "Choose an activity type",
  INVALID_PLACE: "Choose a public place",
  INVALID_TIME: "Start time must be in the future",
  INVALID_DURATION: "Choose a duration between 15 minutes and 4 hours",
  INVALID_CAPACITY: "Minimum people must be between 2 and capacity",
};

function fail(error: PostgrestError | { message: string; code?: string }): never {
  if (error.code === "42501") throw new Error("Sign in required");
  const code = Object.keys(errorText).find((c) => error.message.includes(c));
  throw new Error(code ? errorText[code] : error.message);
}

function toBoardRow(row: BoardViewRow, userId: string | null): ActivityBoardRow {
  const status =
    row.status === "open" && row.participant_count >= row.min_people ? "confirmed" : row.status;
  return {
    id: row.id,
    type_id: row.type_id,
    kind: visualKind(row.activity_name, row.keywords ?? []),
    activity_name: row.activity_name,
    niche_value: row.niche_value,
    place_id: row.place_id,
    place_name: row.place_name,
    address: row.place_address ?? "",
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    starts_at: row.starts_at,
    duration_min: row.duration_min,
    capacity: row.capacity,
    min_people: row.min_people,
    status,
    joined_count: row.participant_count,
    available_spots: row.spots_left,
    creator_id: row.is_mine && userId ? userId : "",
    my_status: row.my_status,
  };
}

export function createSupabaseBackend(supabase: SupabaseClient) {
  async function userId(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }
  async function requireUserId(): Promise<string> {
    const id = await userId();
    if (!id) throw new Error("Sign in required");
    return id;
  }

  return {
    async getBoard(filters: BoardFilters = {}): Promise<ActivityBoardRow[]> {
      let query = supabase
        .from("activity_board")
        .select("*")
        .eq("status", "open")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at");
      if (filters.typeId) query = query.eq("type_id", filters.typeId);
      const [{ data, error }, me] = await Promise.all([query, userId()]);
      if (error) fail(error);
      return (data as BoardViewRow[])
        .map((r) => toBoardRow(r, me))
        .filter(
          (r) =>
            (!filters.date || torontoDate(r.starts_at) === filters.date) &&
            (!filters.timeFrom || torontoTime(r.starts_at) >= filters.timeFrom) &&
            (!filters.timeTo || torontoTime(r.starts_at) <= filters.timeTo),
        );
    },

    async getActivity(id: string): Promise<ActivityBoardRow> {
      const [{ data, error }, me] = await Promise.all([
        supabase.from("activity_board").select("*").eq("id", id).maybeSingle(),
        userId(),
      ]);
      if (error) fail(error);
      if (!data) throw new Error("Activity not found");
      return toBoardRow(data as BoardViewRow, me);
    },

    async getActivityTypes(): Promise<ActivityType[]> {
      const { data, error } = await supabase
        .from("activity_types")
        .select("id, name, niche_value, keywords")
        .order("niche_value")
        .order("name");
      if (error) fail(error);
      return (data as ActivityType[]).map((t) => ({ ...t, keywords: t.keywords ?? [] }));
    },

    async getPublicPlaces(): Promise<Place[]> {
      const { data, error } = await supabase
        .from("places")
        .select("id, name, address, lat, lng, is_public")
        .eq("is_public", true)
        .order("name");
      if (error) fail(error);
      return (
        data as {
          id: string;
          name: string;
          address: string | null;
          lat: number | null;
          lng: number | null;
          is_public: boolean;
        }[]
      ).map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address ?? "",
        lat: p.lat ?? 0,
        lng: p.lng ?? 0,
        is_public: p.is_public,
      }));
    },

    async joinActivity(id: string): Promise<number> {
      const { data, error } = await supabase.rpc("join_activity", { p_activity_id: id });
      if (error) fail(error);
      return (data as { participant_count: number }).participant_count;
    },

    async leaveActivity(id: string): Promise<number> {
      const { data, error } = await supabase.rpc("leave_activity", { p_activity_id: id });
      if (error) fail(error);
      return (data as { participant_count: number }).participant_count;
    },

    async confirmAttendance(id: string): Promise<ConfirmResult> {
      const { data, error } = await supabase.rpc("confirm_attendance", { p_activity_id: id });
      if (error) fail(error);
      return data as ConfirmResult;
    },

    async createActivity(input: {
      type_id: string;
      place_id: string;
      starts_at: string;
      capacity: number;
      min_people: number;
    }): Promise<string> {
      const { data, error } = await supabase.rpc("create_activity", {
        p_type_id: input.type_id,
        p_place_id: input.place_id,
        p_starts_at: input.starts_at,
        p_duration_min: 60,
        p_capacity: input.capacity,
        p_min_people: input.min_people,
      });
      if (error) fail(error);
      return (data as { activity_id: string }).activity_id;
    },

    /** Calls the planned ai-search Edge Function. Returns null when it isn't deployed or fails. */
    async aiSearch(text: string): Promise<unknown> {
      const { data, error } = await supabase.functions.invoke("ai-search", {
        body: { text, today: torontoDate(), timezone: "America/Toronto" },
      });
      return error ? null : (data as unknown);
    },

    mapBoardRows(rows: unknown[], me: string | null): ActivityBoardRow[] {
      return (rows as BoardViewRow[]).map((r) => toBoardRow(r, me));
    },

    userId,

    async signIn(email: string, password: string): Promise<Profile> {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const profile = await this.getMyProfile();
      if (!profile) throw new Error("Account not found. Try signing up.");
      return profile;
    },

    async signUp(email: string, displayName: string, password: string): Promise<Profile> {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (error) throw new Error(error.message);
      if (!data.session) throw new Error("Check your inbox to confirm your email, then sign in.");
      const profile = await this.getMyProfile();
      if (!profile) throw new Error("Your profile is not ready yet. Try signing in.");
      return profile;
    },

    /** Redirects to Google; Supabase brings the browser back here with a session. */
    async signInWithGoogle(redirectTo: string): Promise<void> {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
    },

    async signOut(): Promise<void> {
      await supabase.auth.signOut();
    },

    async getMyProfile(): Promise<Profile | null> {
      const id = await userId();
      if (!id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, total_points")
        .eq("id", id)
        .maybeSingle();
      if (error) fail(error);
      return (data as Profile | null) ?? null;
    },

    async getMyPoints(): Promise<PointsEntry[]> {
      const id = await requireUserId();
      const { data, error } = await supabase
        .from("points")
        .select("activity_id, amount, created_at")
        .order("created_at", { ascending: false });
      if (error) fail(error);
      return (data as { activity_id: string; amount: number; created_at: string }[]).map((p) => ({
        id: `points-${p.activity_id}`,
        user_id: id,
        ...p,
      }));
    },

    async getMyActivities(): Promise<(Participant & { activity: ActivityBoardRow })[]> {
      const id = await requireUserId();
      const { data, error } = await supabase
        .from("activity_board")
        .select("*")
        .not("my_status", "is", null)
        .order("starts_at", { ascending: false });
      if (error) fail(error);
      return (data as BoardViewRow[]).map((r) => ({
        activity_id: r.id,
        user_id: id,
        status: r.my_status ?? "joined",
        joined_at: r.starts_at,
        activity: toBoardRow(r, id),
      }));
    },
  };
}

export type SupabaseBackend = ReturnType<typeof createSupabaseBackend>;
