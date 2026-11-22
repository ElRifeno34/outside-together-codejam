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
