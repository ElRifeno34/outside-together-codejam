import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBackend } from "./supabase-backend";
import { visualKind } from "@/lib/activity-visuals";
import { selectBoardRows } from "./board-options";
import { googleCalendarUrl, icsContent } from "@/lib/calendar";
import type { ActivityBoardRow } from "@/lib/types";

const viewRow = {
  id: "a1",
  type_id: "t-basket",
  activity_name: "Basketball",
  niche_value: 1,
  keywords: ["basketball", "basket"],
  points_value: 15,
  place_id: "p1",
  place_name: "Demo campus court",
  place_address: "Montréal",
  lat: 45.5,
  lng: -73.57,
  starts_at: "2099-01-01T20:00:00.000Z",
  ends_at: "2099-01-01T21:00:00.000Z",
  duration_min: 60,
  capacity: 6,
  min_people: 2,
  status: "open",
  is_mine: true,
  participant_count: 3,
  spots_left: 3,
  is_full: false,
  my_status: "joined",
};

/** Minimal stand-in for the parts of supabase-js the backend uses. */
function fakeClient(opts: {
  rows?: unknown[];
  rpc?: { data: unknown; error: { message: string; code?: string } | null };
  userId?: string | null;
}) {
  const query = {
    select: () => query,
    eq: () => query,
    gt: () => query,
    not: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: opts.rows?.[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: opts.rows ?? [], error: null }),
  };
  return {
    from: () => query,
    rpc: async () => opts.rpc ?? { data: null, error: null },
    auth: {
      getSession: async () => ({
        data: { session: opts.userId ? { user: { id: opts.userId } } : null },
      }),
    },
  } as unknown as SupabaseClient;
}

test("maps activity_board rows onto the screen model", async () => {
  const backend = createSupabaseBackend(fakeClient({ rows: [viewRow], userId: "me" }));
  const [row] = await backend.getBoard();
  expect(row).toMatchObject({
    id: "a1",
    kind: "basketball",
    address: "Montréal",
    joined_count: 3,
    available_spots: 3,
    status: "confirmed", // open and at/above min_people
    creator_id: "me",
    my_status: "joined",
  });
});

test("filters the board by Montréal day and time", async () => {
  const backend = createSupabaseBackend(fakeClient({ rows: [viewRow] }));
  expect(await backend.getBoard({ date: "2099-01-01", timeFrom: "14:00" })).toHaveLength(1);
  expect(await backend.getBoard({ date: "2099-01-02" })).toHaveLength(0);
  expect(await backend.getBoard({ timeFrom: "16:00" })).toHaveLength(0);
});

test("turns backend error codes into readable messages", async () => {
  const full = createSupabaseBackend(
    fakeClient({ rpc: { data: null, error: { message: "ACTIVITY_FULL" } } }),
  );
  await expect(full.joinActivity("a1")).rejects.toThrow("Activity is full");
  const anon = createSupabaseBackend(
    fakeClient({ rpc: { data: null, error: { message: "permission denied", code: "42501" } } }),
  );
  await expect(
    anon.confirmAttendance("a1", { lat: 45.5, lng: -73.6, accuracy: 10 }),
  ).rejects.toThrow("Sign in required");
});

test("returns the confirm_attendance outcome", async () => {
  const outcome = {
    points_earned: 0,
    points_unlocked: false,
    waiting_for: 1,
    total_points: 0,
  };
  const backend = createSupabaseBackend(fakeClient({ rpc: { data: outcome, error: null } }));
  expect(await backend.confirmAttendance("a1", { lat: 45.5, lng: -73.6, accuracy: 10 })).toEqual(
    outcome,
  );
});

test("picks a local photo for backend activity names", () => {
  expect(visualKind("Photo walk", ["photography", "photo"])).toBe("photo");
  expect(visualKind("Something new")).toBe("walk");
});

test("sorts the board by distance when a position is known", () => {
  const near = { ...viewRow, id: "near", lat: 45.5, lng: -73.57 } as unknown as ActivityBoardRow;
  const far = { ...viewRow, id: "far", lat: 45.6, lng: -73.7 } as unknown as ActivityBoardRow;
  const origin = { lat: 45.501, lng: -73.571 };
  expect(selectBoardRows([far, near], null, "nearest", origin).map((r) => r.id)).toEqual([
    "near",
    "far",
  ]);
  // Without a position, "nearest" falls back to soonest first.
  expect(selectBoardRows([far, near], null, "nearest", null)).toHaveLength(2);
});

test("builds Google Calendar links and .ics files without any API key", () => {
  const activity = {
    id: "a1",
    activity_name: "Basketball",
    place_name: "Court",
    address: "Montréal, QC",
    starts_at: "2099-01-01T20:00:00.000Z",
    duration_min: 60,
  };
  const url = new URL(googleCalendarUrl(activity, "https://example.test/activity/a1"));
  expect(url.hostname).toBe("calendar.google.com");
  expect(url.searchParams.get("dates")).toBe("20990101T200000Z/20990101T210000Z");
  const ics = icsContent(activity, "https://example.test/activity/a1", new Date(0));
  expect(ics).toContain("DTSTART:20990101T200000Z");
  expect(ics).toContain("LOCATION:Court\\, Montréal\\, QC");
});
