// Screen-level data shapes. supabase-backend.ts maps the Role B tables and the
// activity_board view (migrations 001–007) onto these.

/** "confirmed" is derived on the client: an open activity at or above min_people. */
export type ActivityStatus = "open" | "confirmed" | "done" | "cancelled";

export interface ActivityBoardRow {
  id: string;
  type_id: string;
  activity_name: string;
  niche_value: number;
  place_id: string;
  place_name: string;
  address: string;
  lat: number;
  lng: number;
  starts_at: string;
  duration_min: number;
  capacity: number;
  min_people: number;
  status: ActivityStatus;
  joined_count: number;
  available_spots: number;
  /** The caller's id when activity_board.is_mine is true, otherwise "". */
  creator_id: string;
  /** Local photo/icon key derived from the activity type's name and keywords. */
  kind?: string;
  /** Caller's registration from activity_board.my_status. */
  my_status?: "joined" | "confirmed" | null;
  /** Custom title set by the creator (migration 015); null → the type name. */
  title?: string | null;
  /** Storage path and public URL of the creator's photo; null → the type's photo. */
  photo_path?: string | null;
  photo_url?: string | null;
  /** True when the creator dropped a pin on the map instead of a preset place. */
  is_custom_location?: boolean;
}

/** The name to show: the creator's custom title, else the activity type. */
export function activityTitle(row: Pick<ActivityBoardRow, "title" | "activity_name">): string {
  return row.title?.trim() || row.activity_name;
}

/** Key into activityImages / activityIcons for any board row. */
export function visualKey(row: Pick<ActivityBoardRow, "type_id" | "kind">): string {
  return row.kind ?? row.type_id;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  is_public: boolean;
}

export interface ActivityType {
  id: string;
  name: string;
  niche_value: number;
  keywords: string[];
}

export interface Profile {
  id: string;
  display_name: string;
  total_points: number;
}

/** A place to visit (migration 013), independent of activities. */
export interface Spot {
  id: string;
  name: string;
  description: string;
  area: string | null;
  lat: number;
  lng: number;
  niche_value: number;
  /** Key into activityImages. */
  photo: string;
}

export interface SpotVisit {
  spot_id: string;
  points: number;
  visited_at: string;
}

export interface Area {
  name: string;
  kind: "borough" | "suburb";
}

export type RankingScope = "area" | "world" | "friends";

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  area: string | null;
  total_points: number;
  is_me: boolean;
}

export interface Participant {
  activity_id: string;
  user_id: string;
  status: "joined" | "confirmed" | "left";
  joined_at: string;
}

export interface PointsEntry {
  id: string;
  user_id: string;
  activity_id: string;
  amount: number;
  created_at: string;
}
