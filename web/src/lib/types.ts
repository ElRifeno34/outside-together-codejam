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
