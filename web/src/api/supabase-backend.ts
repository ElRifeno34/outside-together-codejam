// Real implementations of the core API on top of the Supabase contract in docs/BACKEND.md.
// src/api/index.ts is the thin layer the screens call; it builds this from src/lib/supabase.ts.
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { torontoDate, torontoTime } from "@/lib/time";
import { visualKind } from "@/lib/activity-visuals";
import type { DevicePosition } from "@/lib/geo";
import type {
  ActivityBoardRow,
  ActivityType,
  Participant,
  Place,
  PointsEntry,
  Profile,
  Area,
  LeaderboardRow,
  RankingScope,
  Spot,
  SpotVisit,
} from "@/lib/types";

/** Row shape of the public.activity_board view (migration 007). */
type BoardViewRow = {
  id: string;
  type_id: string;
  activity_name: string;
  niche_value: number;
  keywords: string[] | null;
  points_value: number;
  place_id: string | null;
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
  title?: string | null;
  photo_path?: string | null;
  is_custom_location?: boolean | null;
};

/** Where an activity happens: a preset public place, or a pin dropped on the map. */
export type ActivityLocation = { name: string; address: string; lat: number; lng: number };

export type ActivityInput = {
  type_id: string;
  place_id: string | null;
  starts_at: string;
  capacity: number;
  min_people: number;
  title?: string | null;
  photo_path?: string | null;
  location?: ActivityLocation | null;
};

export const PHOTO_BUCKET = "activity-photos";

function detailArgs(input: ActivityInput) {
  const loc = input.location ?? null;
  return {
    p_type_id: input.type_id,
    p_place_id: loc ? null : input.place_id,
    p_starts_at: input.starts_at,
    p_duration_min: 60,
    p_capacity: input.capacity,
    p_min_people: input.min_people,
    p_title: input.title?.trim() || null,
    p_photo_path: input.photo_path ?? null,
    p_location_name: loc?.name ?? null,
    p_location_address: loc?.address ?? null,
    p_location_lat: loc?.lat ?? null,
    p_location_lng: loc?.lng ?? null,
  };
}

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
  LOCATION_REQUIRED: "Allow location access to check in",
  INVALID_LOCATION: "Location is unavailable on this device",
  TOO_FAR_FROM_PLACE: "You need to be within 200 m of the place to check in",
  INVALID_TYPE: "Choose an activity type",
  INVALID_PLACE: "Choose a public place",
  INVALID_TITLE: "A title needs 3 to 80 characters",
  INVALID_PHOTO: "That photo can't be used. Upload it again",
  LOCATION_OUTSIDE_MONTREAL: "Pick a spot in the Montréal area",
  INVALID_PIN: "Drop a pin on the map and give the spot a name",
  INVALID_TIME: "Start time must be in the future",
  INVALID_DURATION: "Choose a duration between 15 minutes and 4 hours",
  INVALID_CAPACITY: "Minimum people must be between 2 and capacity",
  NOT_CREATOR: "Only the person who created this activity can edit it",
  CAPACITY_BELOW_JOINED: "Capacity can't be lower than the number of people already in",
  SPOT_NOT_FOUND: "This place is no longer on the list",
  ALREADY_VISITED: "You already got the points for this place",
  TOO_FAR_FROM_SPOT: "You need to be within 200 m of the place to collect its points",
  FRIEND_CODE_NOT_FOUND: "No one has that friend code. Check it and try again",
  CANNOT_ADD_SELF: "That's your own friend code",
  INVALID_SCOPE: "Unknown ranking",
};

function fail(error: PostgrestError | { message: string; code?: string }): never {
  if (error.code === "42501") throw new Error("Sign in required");
  const code = Object.keys(errorText).find((c) => error.message.includes(c));
  throw new Error(code ? errorText[code] : error.message);
}

function toBoardRow(
  row: BoardViewRow,
  userId: string | null,
  photoUrl: (path: string) => string = (p) => p,
): ActivityBoardRow {
  const status =
    row.status === "open" && row.participant_count >= row.min_people ? "confirmed" : row.status;
  return {
    id: row.id,
    type_id: row.type_id,
    kind: visualKind(row.activity_name, row.keywords ?? []),
    activity_name: row.activity_name,
    niche_value: row.niche_value,
    place_id: row.place_id ?? "",
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
    title: row.title ?? null,
    photo_path: row.photo_path ?? null,
    photo_url: row.photo_path ? photoUrl(row.photo_path) : null,
    is_custom_location: !!row.is_custom_location,
  };
}

export function createSupabaseBackend(supabase: SupabaseClient) {
  async function userId(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }
  const photoUrl = (path: string) =>
    supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
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
        .map((r) => toBoardRow(r, me, photoUrl))
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
      return toBoardRow(data as BoardViewRow, me, photoUrl);
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

    async confirmAttendance(id: string, at: DevicePosition): Promise<ConfirmResult> {
      const { data, error } = await supabase.rpc("confirm_attendance", {
        p_activity_id: id,
        p_lat: at.lat,
        p_lng: at.lng,
        p_accuracy_m: Math.round(at.accuracy),
      });
      if (error) fail(error);
      return data as ConfirmResult;
    },

    async createActivity(input: ActivityInput): Promise<string> {
      const { data, error } = await supabase.rpc("create_activity", detailArgs(input));
      if (error) fail(error);
      return (data as { activity_id: string }).activity_id;
    },

    async updateActivity(id: string, input: ActivityInput): Promise<void> {
      const { error } = await supabase.rpc("update_activity", {
        p_activity_id: id,
        ...detailArgs(input),
      });
      if (error) fail(error);
    },

    /** Uploads a (resized) photo under <user id>/ and returns its storage path. */
    async uploadActivityPhoto(file: Blob, extension: string): Promise<string> {
      const id = await userId();
      if (!id) throw new Error("Sign in required");
      const path = `${id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      return path;
    },

    photoUrl,

    /** Calls the planned ai-search Edge Function. Returns null when it isn't deployed or fails. */
    async aiSearch(text: string): Promise<unknown> {
      const { data, error } = await supabase.functions.invoke("ai-search", {
        body: { text, today: torontoDate(), timezone: "America/Toronto" },
      });
      return error ? null : (data as unknown);
    },

    // ---- Places to visit, rankings and friends (migration 013) ----

    async getSpots(): Promise<Spot[]> {
      const { data, error } = await supabase
        .from("spots")
        .select("id, name, description, area, lat, lng, niche_value, photo")
        .order("niche_value")
        .order("name");
      if (error) fail(error);
      return data as Spot[];
    },

    async getMyVisits(): Promise<SpotVisit[]> {
      if (!(await userId())) return [];
      const { data, error } = await supabase
        .from("spot_visits")
        .select("spot_id, points, visited_at")
        .order("visited_at", { ascending: false });
      if (error) fail(error);
      return data as SpotVisit[];
    },

    async visitSpot(
      id: string,
      at: DevicePosition,
    ): Promise<{ points_earned: number; total_points: number; distance_m: number }> {
      const { data, error } = await supabase.rpc("visit_spot", {
        p_spot_id: id,
        p_lat: at.lat,
        p_lng: at.lng,
        p_accuracy_m: Math.round(at.accuracy),
      });
      if (error) fail(error);
      return data as { points_earned: number; total_points: number; distance_m: number };
    },

    async getAreas(): Promise<Area[]> {
      const { data, error } = await supabase.from("areas").select("name, kind").order("name");
      if (error) fail(error);
      return data as Area[];
    },

    async getMyArea(): Promise<string | null> {
      const id = await userId();
      if (!id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("area")
        .eq("id", id)
        .maybeSingle();
      if (error) fail(error);
      return (data as { area: string | null } | null)?.area ?? null;
    },

    async setMyArea(area: string | null): Promise<void> {
      const id = await userId();
      if (!id) throw new Error("Sign in required");
      const { error } = await supabase.from("profiles").update({ area }).eq("id", id);
      if (error) fail(error);
    },

    async getLeaderboard(scope: RankingScope, area?: string | null): Promise<LeaderboardRow[]> {
      const { data, error } = await supabase.rpc("get_leaderboard", {
        p_scope: scope,
        p_area: area ?? null,
      });
      if (error) fail(error);
      return (data ?? []) as LeaderboardRow[];
    },

    async getMyFriendCode(): Promise<string> {
      const { data, error } = await supabase.rpc("my_friend_code");
      if (error) fail(error);
      return data as string;
    },

    async addFriend(code: string): Promise<{ friend_id: string; display_name: string }> {
      const { data, error } = await supabase.rpc("add_friend", { p_code: code });
      if (error) fail(error);
      return data as { friend_id: string; display_name: string };
    },

    async removeFriend(friendId: string): Promise<void> {
      const { error } = await supabase.rpc("remove_friend", { p_friend_id: friendId });
      if (error) fail(error);
    },

    mapBoardRows(rows: unknown[], me: string | null): ActivityBoardRow[] {
      return (rows as BoardViewRow[]).map((r) => toBoardRow(r, me, photoUrl));
    },

    userId,

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
        activity: toBoardRow(r, id, photoUrl),
      }));
    },
  };
}

export type SupabaseBackend = ReturnType<typeof createSupabaseBackend>;
