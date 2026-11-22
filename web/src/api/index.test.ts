import { beforeEach, describe, expect, it, vi } from "vitest";
import { boardRow, createFakeSupabase } from "@/test/fake-supabase";

// The app's API layer running against an in-memory Supabase client (no network).
const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock("@/lib/supabase", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/supabase")>();
  const { createFakeSupabase: make } = await import("@/test/fake-supabase");
  fake.current = make();
  return { ...real, supabase: fake.current.client, backendMode: "supabase" };
});
import * as api from "./index";

const db = () => fake.current!.state;

const types = [
  { id: "type-walk", name: "Walk", niche_value: 1, keywords: ["walk", "balade"] },
  { id: "type-basket", name: "Basketball", niche_value: 1, keywords: ["basketball", "basket"] },
  { id: "type-chess", name: "Chess", niche_value: 3, keywords: ["chess", "échecs"] },
];
const places = [
  {
    id: "place-park",
    name: "Parc La Fontaine",
    address: "Montréal",
    lat: 45.52,
    lng: -73.56,
    is_public: true,
  },
  {
    id: "place-court",
    name: "Parc Jeanne-Mance courts",
    address: "Montréal",
    lat: 45.51,
    lng: -73.58,
    is_public: true,
  },
];

beforeEach(() => {
  const s = db();
  s.tables = {
    activity_types: types.map((t) => ({ ...t })),
    places: places.map((p) => ({ ...p })),
    activity_board: [
      boardRow(),
      boardRow({
        id: "act-chess",
        type_id: "type-chess",
        activity_name: "Chess",
        niche_value: 3,
        keywords: ["chess"],
        points_value: 25,
        starts_at: "2099-01-03T15:00:00.000Z",
        participant_count: 2,
        spots_left: 2,
        capacity: 4,
      }),
    ],
    profiles: [],
    points: [],
  };
  s.rpc = {};
  s.rpcCalls = [];
  s.userId = null;
  s.aiSearch = null;
  s.oauthCalls = [];
});

describe("reading the real board", () => {
  it("maps activity_board rows and marks open activities at the minimum as happening", async () => {
    const rows = await api.getBoard();
    expect(rows.map((r) => r.id)).toEqual(["act-1", "act-chess"]);
    expect(rows[0]).toMatchObject({
      activity_name: "Basketball",
      kind: "basketball",
      joined_count: 1,
      available_spots: 5,
      status: "open",
      address: "Av. du Parc & Rue Duluth, Montréal",
    });
    expect(rows[1]).toMatchObject({ status: "confirmed", joined_count: 2, kind: "chess" });
  });

  it("filters by type, Montréal day and time", async () => {
    expect((await api.getBoard({ typeId: "type-chess" })).map((r) => r.id)).toEqual(["act-chess"]);
    expect(await api.getBoard({ date: "2099-01-02" })).toHaveLength(1);
    expect(await api.getBoard({ timeFrom: "16:00" })).toHaveLength(0);
  });

  it("hides finished and past activities from the board", async () => {
    db().tables.activity_board!.push(
      boardRow({ id: "done", status: "done" }),
      boardRow({ id: "past", starts_at: "2000-01-01T00:00:00.000Z" }),
    );
    expect((await api.getBoard()).map((r) => r.id)).not.toContain("done");
    expect((await api.getBoard()).map((r) => r.id)).not.toContain("past");
  });

  it("opens an activity by id and reports a missing one", async () => {
    expect((await api.getActivity("act-chess")).activity_name).toBe("Chess");
    await expect(api.getActivity("nope")).rejects.toThrow("Activity not found");
  });

  it("loads real activity types and public places", async () => {
    expect((await api.getActivityTypes()).map((t) => t.id)).toContain("type-chess");
    expect((await api.getPublicPlaces()).map((p) => p.id)).toEqual(["place-court", "place-park"]);
  });
});

describe("accounts", () => {
  it("reads the signed-in profile and signs out", async () => {
    db().userId = "user:b";
    db().tables.profiles!.push({ id: "user:b", display_name: "Tester B", total_points: 15 });
    expect((await api.getMyProfile())?.total_points).toBe(15);
    await api.signOut();
    expect(await api.getMyProfile()).toBeNull();
  });

  it("has no email/password sign-in: Google is the only way in", () => {
    expect("signIn" in api).toBe(false);
    expect("signUp" in api).toBe(false);
  });

  it("starts Google sign-in through Supabase with the return address", async () => {
    await api.signInWithGoogle("http://localhost:8080/activity/act-1?tab=info");
    // Redirect to the bare origin (always on the allow list) and remember the page.
    expect(db().oauthCalls).toEqual([{ provider: "google", redirectTo: "http://localhost:8080/" }]);
    expect(api.takeReturnPath()).toBe("/activity/act-1?tab=info");
    expect(api.takeReturnPath()).toBeNull();
  });

  it("explains a refused Google sign-up once and cleans the address", () => {
    window.history.replaceState(
      null,
      "",
      "/?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user",
    );
    expect(api.takeSignInError()).toBe(
      "This email already had an Outside Together account, so it can’t create a new one.",
    );
    expect(window.location.search).toBe("");
    expect(api.takeSignInError()).toBeNull();
  });

  it("falls back to a generic message for other sign-in errors", () => {
    window.history.replaceState(null, "", "/#error=access_denied&error_description=User+cancelled");
    expect(api.takeSignInError()).toBe("Google sign-in didn’t work. Please try again.");
    expect(window.location.hash).toBe("");
  });
});

describe("join, leave and create through the Role B RPCs", () => {
  it("joins and leaves with the activity id and returns the new count", async () => {
    db().userId = "me";
    db().rpc.join_activity = () => ({ data: { participant_count: 2 }, error: null });
    db().rpc.leave_activity = () => ({ data: { participant_count: 1 }, error: null });
    expect(await api.joinActivity("act-1")).toBe(2);
    expect(await api.leaveActivity("act-1")).toBe(1);
    expect(db().rpcCalls).toEqual([
      { name: "join_activity", args: { p_activity_id: "act-1" } },
      { name: "leave_activity", args: { p_activity_id: "act-1" } },
    ]);
  });

  it("turns backend error codes into readable messages", async () => {
    db().rpc.join_activity = () => ({ data: null, error: { message: "ACTIVITY_FULL" } });
    await expect(api.joinActivity("act-1")).rejects.toThrow("Activity is full");
    db().rpc.join_activity = () => ({ data: null, error: { message: "ACTIVITY_STARTED" } });
    await expect(api.joinActivity("act-1")).rejects.toThrow("Registration is closed");
    db().rpc.join_activity = () => ({ data: null, error: { message: "denied", code: "42501" } });
    await expect(api.joinActivity("act-1")).rejects.toThrow("Sign in required");
  });

  it("creates a one-hour activity with real type and place ids", async () => {
    db().rpc.create_activity = () => ({ data: { activity_id: "new-id" }, error: null });
    const id = await api.createActivity({
      type_id: "type-chess",
      place_id: "place-park",
      starts_at: "2099-01-05T19:00:00.000Z",
      capacity: 6,
      min_people: 2,
    });
    expect(id).toBe("new-id");
    expect(db().rpcCalls.at(-1)).toEqual({
      name: "create_activity",
      args: {
        p_type_id: "type-chess",
        p_place_id: "place-park",
        p_starts_at: "2099-01-05T19:00:00.000Z",
        p_duration_min: 60,
        p_capacity: 6,
        p_min_people: 2,
        p_title: null,
        p_photo_path: null,
        p_location_name: null,
        p_location_address: null,
        p_location_lat: null,
        p_location_lng: null,
      },
    });
  });

  it("reports invalid creation input from the backend", async () => {
    db().rpc.create_activity = () => ({ data: null, error: { message: "INVALID_TIME" } });
    await expect(
      api.createActivity({
        type_id: "type-chess",
        place_id: "place-park",
        starts_at: "2000-01-01T00:00:00.000Z",
        capacity: 6,
        min_people: 2,
      }),
    ).rejects.toThrow("Start time must be in the future");
  });
});

describe("editing an activity", () => {
  const changes = {
    type_id: "type-chess",
    place_id: "place-park",
    starts_at: "2099-02-01T15:00:00.000Z",
    capacity: 8,
    min_people: 2,
  };

  it("sends the new details to update_activity", async () => {
    db().rpc.update_activity = () => ({ data: { activity_id: "act-1" }, error: null });
    await api.updateActivity("act-1", changes);
    expect(db().rpcCalls.at(-1)).toEqual({
      name: "update_activity",
      args: {
        p_activity_id: "act-1",
        p_type_id: "type-chess",
        p_place_id: "place-park",
        p_starts_at: "2099-02-01T15:00:00.000Z",
        p_duration_min: 60,
        p_capacity: 8,
        p_min_people: 2,
        p_title: null,
        p_photo_path: null,
        p_location_name: null,
        p_location_address: null,
        p_location_lat: null,
        p_location_lng: null,
      },
    });
  });

  it("explains why someone else can't edit it", async () => {
    db().rpc.update_activity = () => ({ data: null, error: { message: "NOT_CREATOR" } });
    await expect(api.updateActivity("act-1", changes)).rejects.toThrow(
      "Only the person who created this activity can edit it",
    );
  });
});

describe("We're here: confirmation and points", () => {
  const here = { lat: 45.5, lng: -73.6, accuracy: 12.4 };

  it("refuses a check-in far from the place", async () => {
    db().rpc.confirm_attendance = () => ({
      data: null,
      error: { message: "TOO_FAR_FROM_PLACE (850 m)" },
    });
    await expect(api.confirmAttendance("act-chess", here)).rejects.toThrow(
      "You need to be within 200 m of the place to check in",
    );
  });

  it("asks for location when the server gets none", async () => {
    db().rpc.confirm_attendance = () => ({ data: null, error: { message: "LOCATION_REQUIRED" } });
    await expect(api.confirmAttendance("act-chess", here)).rejects.toThrow(
      "Allow location access to check in",
    );
  });

  it("first check-in waits for one more participant", async () => {
    db().rpc.confirm_attendance = () => ({
      data: { points_earned: 0, points_unlocked: false, waiting_for: 1, total_points: 0 },
      error: null,
    });
    expect(await api.confirmAttendance("act-chess", here)).toEqual({
      points_earned: 0,
      points_unlocked: false,
      waiting_for: 1,
      total_points: 0,
    });
    expect(db().rpcCalls.at(-1)).toEqual({
      name: "confirm_attendance",
      args: { p_activity_id: "act-chess", p_lat: 45.5, p_lng: -73.6, p_accuracy_m: 12 },
    });
  });

  it("second check-in unlocks the niche-weighted points", async () => {
    db().rpc.confirm_attendance = () => ({
      data: { points_earned: 25, points_unlocked: true, waiting_for: 0, total_points: 25 },
      error: null,
    });
    expect(await api.confirmAttendance("act-chess", here)).toMatchObject({
      points_unlocked: true,
      points_earned: 25,
    });
  });

  it("explains a check-in before the start", async () => {
    db().rpc.confirm_attendance = () => ({
      data: null,
      error: { message: "ACTIVITY_NOT_STARTED" },
    });
    await expect(api.confirmAttendance("act-chess", here)).rejects.toThrow(
      "You can confirm once the activity has started",
    );
  });

  it("profile reads the account's points and activities", async () => {
    db().userId = "me";
    db().tables.points = [
      { activity_id: "act-chess", amount: 25, created_at: "2099-01-03T16:00:00.000Z" },
    ];
    db().tables.activity_board!.push(
      boardRow({
        id: "mine",
        my_status: "confirmed",
        status: "done",
        starts_at: "2000-01-01T00:00:00.000Z",
      }),
    );
    expect(await api.getMyPoints()).toEqual([
      {
        id: "points-act-chess",
        user_id: "me",
        activity_id: "act-chess",
        amount: 25,
        created_at: "2099-01-03T16:00:00.000Z",
      },
    ]);
    const mine = await api.getMyActivities();
    expect(mine.map((m) => [m.activity_id, m.status])).toEqual([["mine", "confirmed"]]);
  });

  it("requires a session for personal data", async () => {
    await expect(api.getMyPoints()).rejects.toThrow("Sign in required");
    await expect(api.getMyActivities()).rejects.toThrow("Sign in required");
  });
});

describe("search without AI", () => {
  it("falls back to keyword search when the assistant answers filters only", async () => {
    db().aiSearch = { filters: { activity: "chess" } };
    const result = await api.aiSearch("chess anyone?");
    expect(result.status).toBe("match");
    expect(result.status !== "no_match" && result.matches.map((r) => r.id)).toEqual(["act-chess"]);
  });

  it("matches French keywords and the activity name", async () => {
    for (const q of ["des échecs ce soir?", "Chess"]) {
      const result = await api.aiSearch(q.replace(" ce soir", ""));
      expect(result.status !== "no_match" && result.matches.map((r) => r.id)).toEqual([
        "act-chess",
      ]);
    }
  });

  it("finds activities by place name", async () => {
    db().tables.activity_board!.push(
      boardRow({ id: "act-park", place_id: "place-park", place_name: "Parc La Fontaine" }),
    );
    const result = await api.aiSearch("something at La Fontaine");
    expect(result.status !== "no_match" && result.matches.map((r) => r.id)).toEqual(["act-park"]);
  });

  it("says nothing matches instead of listing everything for unknown words", async () => {
    const result = await api.aiSearch("xyzzy");
    expect(result).toMatchObject({ status: "match", matches: [] });
  });

  it("uses the assistant's answer when it has the expected shape", async () => {
    db().aiSearch = {
      status: "match",
      matches: [boardRow({ id: "from-ai" })],
      message: "Found one",
    };
    const result = await api.aiSearch("basketball");
    expect(result).toMatchObject({ status: "match", message: "Found one" });
  });

  it("offers a draft with real ids when nothing matches", async () => {
    const result = await api.aiSearch("basketball on sunday 9am");
    expect(result.status).toBe("no_match");
    if (result.status !== "no_match") return;
    expect(result.draft).toMatchObject({
      type_id: "type-basket",
      place_id: "place-court",
      capacity: 6,
    });
    expect(new Date(result.draft.starts_at).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("places to visit, rankings and friends (migration 013)", () => {
  const here = { lat: 45.5035, lng: -73.587, accuracy: 9.6 };

  it("sends the visit with the device position and returns the points", async () => {
    db().rpc.visit_spot = () => ({
      data: { points_earned: 15, total_points: 40, distance_m: 30 },
      error: null,
    });
    expect(await api.visitSpot("spot-1", here)).toEqual({
      points_earned: 15,
      total_points: 40,
      distance_m: 30,
    });
    expect(db().rpcCalls.at(-1)).toEqual({
      name: "visit_spot",
      args: { p_spot_id: "spot-1", p_lat: 45.5035, p_lng: -73.587, p_accuracy_m: 10 },
    });
  });

  it("explains a visit that is too far or already rewarded", async () => {
    db().rpc.visit_spot = () => ({ data: null, error: { message: "TOO_FAR_FROM_SPOT (640 m)" } });
    await expect(api.visitSpot("spot-1", here)).rejects.toThrow(
      "You need to be within 200 m of the place to collect its points",
    );
    db().rpc.visit_spot = () => ({ data: null, error: { message: "ALREADY_VISITED" } });
    await expect(api.visitSpot("spot-1", here)).rejects.toThrow(
      "You already got the points for this place",
    );
  });

  it("asks the leaderboard for a scope and an area", async () => {
    const rows = [
      {
        rank: 1,
        user_id: "u1",
        display_name: "Léa",
        area: "Verdun",
        total_points: 80,
        is_me: false,
      },
    ];
    db().rpc.get_leaderboard = () => ({ data: rows, error: null });
    expect(await api.getLeaderboard("area", "Verdun")).toEqual(rows);
    expect(db().rpcCalls.at(-1)).toEqual({
      name: "get_leaderboard",
      args: { p_scope: "area", p_area: "Verdun" },
    });
    await api.getLeaderboard("world");
    expect(db().rpcCalls.at(-1)?.args).toEqual({ p_scope: "world", p_area: null });
  });

  it("adds friends by code and explains bad codes", async () => {
    db().rpc.add_friend = () => ({
      data: { friend_id: "u2", display_name: "Sami" },
      error: null,
    });
    // Before migration 018 there was no status: treated as an immediate friendship.
    expect(await api.addFriend("abc123")).toEqual({
      status: "accepted",
      friend_id: "u2",
      display_name: "Sami",
    });
    db().rpc.add_friend = () => ({ data: null, error: { message: "FRIEND_CODE_NOT_FOUND" } });
    await expect(api.addFriend("zzzzzz")).rejects.toThrow("No one has that friend code");
    db().rpc.add_friend = () => ({ data: null, error: { message: "CANNOT_ADD_SELF" } });
    await expect(api.addFriend("mine12")).rejects.toThrow("That's your own friend code");
  });
});

describe("custom title, photo and map location (migration 015)", () => {
  it("sends the pin instead of a preset place, with the custom title", async () => {
    db().rpc.create_activity = () => ({ data: { activity_id: "new-1" }, error: null });
    await api.createActivity({
      type_id: "type-chess",
      place_id: "place-park",
      starts_at: "2099-03-01T18:00:00.000Z",
      capacity: 6,
      min_people: 2,
      title: "  Speed chess by the fountain ",
      photo_path: "me/abc.webp",
      location: { name: "Fountain", address: "Parc Jarry", lat: 45.535, lng: -73.628 },
    });
    expect(db().rpcCalls.at(-1)?.args).toMatchObject({
      p_place_id: null,
      p_title: "Speed chess by the fountain",
      p_photo_path: "me/abc.webp",
      p_location_name: "Fountain",
      p_location_address: "Parc Jarry",
      p_location_lat: 45.535,
      p_location_lng: -73.628,
    });
  });

  it("explains a pin outside Montréal", async () => {
    db().rpc.create_activity = () => ({
      data: null,
      error: { message: "LOCATION_OUTSIDE_MONTREAL" },
    });
    await expect(
      api.createActivity({
        type_id: "type-chess",
        place_id: null,
        starts_at: "2099-03-01T18:00:00.000Z",
        capacity: 6,
        min_people: 2,
        location: { name: "Far", address: "", lat: 48.85, lng: 2.35 },
      }),
    ).rejects.toThrow("Pick a spot in the Montréal area");
  });
});

describe("deleting an activity (migration 016)", () => {
  it("asks delete_activity and reports removed registrations", async () => {
    db().rpc.delete_activity = () => ({
      data: { activity_id: "act-1", others_removed: 2, photo_path: null },
      error: null,
    });
    expect(await api.deleteActivity("act-1")).toEqual({ others_removed: 2 });
    expect(db().rpcCalls.at(-1)).toEqual({
      name: "delete_activity",
      args: { p_activity_id: "act-1" },
    });
  });

  it("explains why it can't be deleted any more", async () => {
    db().rpc.delete_activity = () => ({ data: null, error: { message: "DELETE_TOO_LATE" } });
    await expect(api.deleteActivity("act-1")).rejects.toThrow(
      "This activity has already started, so it can't be deleted",
    );
  });
});

describe("side quests (migration 017)", () => {
  it("saves the activity's quests with their suggestion ids", async () => {
    db().rpc.set_activity_quests = () => ({ data: 2, error: null });
    await api.setActivityQuests("act-1", [
      { title: " Make 3 baskets in a row ", template_id: "tpl-1" },
      { title: "Dunk once", template_id: null },
    ]);
    expect(db().rpcCalls.at(-1)).toEqual({
      name: "set_activity_quests",
      args: {
        p_activity_id: "act-1",
        p_quests: [
          { title: "Make 3 baskets in a row", template_id: "tpl-1" },
          { title: "Dunk once", template_id: null },
        ],
      },
    });
  });

  it("lets the organizer tick and untick an attendee's quest", async () => {
    db().rpc.validate_quest = () => ({ data: { done: true }, error: null });
    await api.validateQuest("q-1", "u-2", true);
    expect(db().rpcCalls.at(-1)).toEqual({
      name: "validate_quest",
      args: { p_quest_id: "q-1", p_user_id: "u-2", p_done: true },
    });
  });

  it("explains refusals from the database", async () => {
    db().rpc.validate_quest = () => ({ data: null, error: { message: "CANNOT_VALIDATE_SELF" } });
    await expect(api.validateQuest("q-1", "me", true)).rejects.toThrow(
      "You can't validate your own side quests",
    );
    db().rpc.set_activity_quests = () => ({ data: null, error: { message: "QUESTS_LOCKED" } });
    await expect(api.setActivityQuests("act-1", [])).rejects.toThrow(
      "Side quests can't change once the activity has started",
    );
  });
});

describe("friend requests (migration 018)", () => {
  it("sending a code creates a request the other person must accept", async () => {
    db().rpc.add_friend = () => ({
      data: { status: "requested", friend_id: "u2", display_name: "Sami" },
      error: null,
    });
    expect(await api.addFriend("abc123")).toMatchObject({ status: "requested" });
  });

  it("accepts, declines and cancels requests", async () => {
    db().rpc.respond_friend_request = () => ({ data: { accepted: true }, error: null });
    await api.respondFriendRequest("u3", true);
    expect(db().rpcCalls.at(-1)).toEqual({
      name: "respond_friend_request",
      args: { p_from: "u3", p_accept: true },
    });
    await api.respondFriendRequest("u3", false);
    expect(db().rpcCalls.at(-1)?.args).toEqual({ p_from: "u3", p_accept: false });
    db().rpc.cancel_friend_request = () => ({ data: null, error: null });
    await api.cancelFriendRequest("u4");
    expect(db().rpcCalls.at(-1)).toEqual({ name: "cancel_friend_request", args: { p_to: "u4" } });
  });

  it("explains a duplicate request", async () => {
    db().rpc.add_friend = () => ({ data: null, error: { message: "REQUEST_ALREADY_SENT" } });
    await expect(api.addFriend("abc123")).rejects.toThrow("You already sent them a request");
  });
});
