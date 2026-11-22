// In-memory stand-in for the parts of supabase-js the app uses, so API tests exercise the
// real code paths (supabase-backend.ts + api/index.ts) without any network access.
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string; code?: string } | null };

type TableName = "activity_board" | "activity_types" | "places" | "profiles" | "points";
type RpcName =
  | "create_activity"
  | "update_activity"
  | "join_activity"
  | "leave_activity"
  | "confirm_attendance"
  | "visit_spot"
  | "get_leaderboard"
  | "add_friend"
  | "my_friend_code"
  | "remove_friend"
  | "delete_activity"
  | "set_activity_quests"
  | "get_quest_board"
  | "validate_quest"
  | "my_friend_requests"
  | "respond_friend_request"
  | "cancel_friend_request"
  | "my_progress"
  | "buy_item"
  | "equip_item"
  | "refresh_my_trophies"
  | "set_showcase"
  | "get_public_profile";

export type FakeState = {
  tables: { [K in TableName]?: Row[] };
  /** Handlers by RPC name; they receive the call's arguments. */
  rpc: { [K in RpcName]?: (args: Row) => Result };
  rpcCalls: { name: string; args: Row }[];
  userId: string | null;
  /** Answer of the ai-search Edge Function; null means it failed or isn't deployed. */
  aiSearch: unknown;
  oauthCalls: { provider: string; redirectTo: string | undefined }[];
};

export function createFakeSupabase() {
  const state: FakeState = {
    tables: {},
    rpc: {},
    rpcCalls: [],
    userId: null,
    aiSearch: null,
    oauthCalls: [],
  };

  function query(table: string) {
    let rows = () => [...(state.tables[table as TableName] ?? [])];
    const filters: ((r: Row) => boolean)[] = [];
    let max = Infinity;
    const run = () => rows().filter((r) => filters.every((f) => f(r)));
    const q = {
      select: () => q,
      eq: (col: string, value: unknown) => (filters.push((r) => r[col] === value), q),
      gt: (col: string, value: string) => (filters.push((r) => String(r[col]) > value), q),
      not: (col: string, op: string, value: unknown) => {
        if (op === "is" && value === null)
          filters.push((r) => r[col] !== null && r[col] !== undefined);
        return q;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        const base = rows;
        rows = () =>
          base().sort(
            (a, b) =>
              (opts?.ascending === false ? -1 : 1) * String(a[col]).localeCompare(String(b[col])),
          );
        return q;
      },
      limit: (n: number) => ((max = n), q),
      maybeSingle: async (): Promise<Result> => ({ data: run()[0] ?? null, error: null }),
      then: (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: run().slice(0, max), error: null }).then(resolve, reject),
    };
    return q;
  }

  const client = {
    from: (table: string) => query(table),
    rpc: async (name: string, args: Row): Promise<Result> => {
      state.rpcCalls.push({ name, args });
      const handler = state.rpc[name as RpcName];
      return handler ? handler(args) : { data: null, error: { message: `no handler for ${name}` } };
    },
    functions: {
      invoke: async () =>
        state.aiSearch === null
          ? { data: null, error: { message: "Function not found" } }
          : { data: state.aiSearch, error: null },
    },
    auth: {
      getSession: async () => ({
        data: { session: state.userId ? { user: { id: state.userId } } : null },
      }),
      signInWithOAuth: async ({
        provider,
        options,
      }: {
        provider: string;
        options?: { redirectTo?: string };
      }) => {
        state.oauthCalls.push({ provider, redirectTo: options?.redirectTo });
        return { data: {}, error: null };
      },
      signOut: async () => {
        state.userId = null;
        return { error: null };
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };

  return { client: client as unknown as SupabaseClient, state };
}

/** An activity_board view row (migration 007 columns) with sensible defaults. */
export function boardRow(overrides: Row = {}): Row {
  return {
    id: "act-1",
    type_id: "type-basket",
    activity_name: "Basketball",
    niche_value: 1,
    keywords: ["basketball", "basket"],
    points_value: 15,
    place_id: "place-court",
    place_name: "Parc Jeanne-Mance courts",
    place_address: "Av. du Parc & Rue Duluth, Montréal",
    lat: 45.5155,
    lng: -73.5835,
    starts_at: "2099-01-02T20:00:00.000Z",
    ends_at: "2099-01-02T21:00:00.000Z",
    duration_min: 60,
    capacity: 6,
    min_people: 2,
    status: "open",
    is_mine: null,
    participant_count: 1,
    spots_left: 5,
    is_full: false,
    my_status: null,
    ...overrides,
  };
}
