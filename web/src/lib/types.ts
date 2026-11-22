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

/** A pending friend request: someone asked you (incoming) or you asked them (outgoing). */
export interface FriendRequest {
  direction: "incoming" | "outgoing";
  user_id: string;
  display_name: string;
  created_at: string;
}

export type AddFriendResult = {
  status: "requested" | "accepted";
  friend_id: string;
  display_name: string;
};

/** A suggested side quest: for one activity type, or for any activity (type_id null). */
export interface QuestTemplate {
  id: string;
  type_id: string | null;
  title: string;
}

/** A side quest attached to an activity (migration 017). */
export interface ActivityQuest {
  id: string;
  activity_id: string;
  title: string;
  template_id: string | null;
  position: number;
}

/** What the form sends: a suggestion (template_id) or the creator's own text. */
export interface QuestDraft {
  title: string;
  template_id: string | null;
}

/** One attendee on the creator's validation grid. */
export interface QuestBoardRow {
  user_id: string;
  display_name: string;
  status: "joined" | "confirmed";
  completed: string[];
}

/** Side quest worth: 5 × the activity's niche value. */
export function questPoints(nicheValue: number): number {
  return 5 * nicheValue;
}

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  area: string | null;
  total_points: number;
  is_me: boolean;
  /** Equipped cosmetics (migration 019); absent before it. */
  avatar_item?: string | null;
  frame_item?: string | null;
  name_effect_item?: string | null;
}

export interface ShopItem {
  id: string;
  kind: "avatar" | "frame" | "banner" | "name_effect";
  name: string;
  price: number;
  sort: number;
  /** false for season-pass rewards (migration 020): not sold in the shop. */
  purchasable?: boolean;
}

export interface TrophyDef {
  id: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  name: string;
  description: string;
  credits: number;
  sort: number;
}

export interface MyProgress {
  credits: number;
  items: string[];
}

export interface PublicProfile {
  id: string;
  display_name: string;
  area: string | null;
  total_points: number;
  avatar_item: string | null;
  frame_item: string | null;
  banner_item: string | null;
  name_effect_item: string | null;
  showcase: string[];
  trophies: string[];
  checkins: number;
  places: number;
  is_me: boolean;
  /** Migration 020: ranks and social links (absent before it). */
  links?: SocialLinks;
  world_rank?: number;
  world_total?: number;
  area_rank?: number | null;
  area_total?: number | null;
}

export type SocialNetwork =
  "linkedin" | "instagram" | "tiktok" | "x" | "github" | "youtube" | "website";
export type SocialLinks = Partial<Record<SocialNetwork, string>>;

export interface SeasonReward {
  tier: number;
  credits: number;
  item_id: string | null;
  item_kind: "avatar" | "frame" | "banner" | "name_effect" | null;
  item_name: string | null;
}

export interface Season {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  points_per_tier: number;
  points: number;
  tier: number;
  claimed: number[];
  rewards: SeasonReward[];
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  activity_id: string | null;
  body: string;
  created_at: string;
}

export interface Conversation {
  friend_id: string;
  display_name: string;
  avatar_item: string | null;
  frame_item: string | null;
  name_effect_item: string | null;
  last_body: string | null;
  last_at: string | null;
  last_from_me: boolean | null;
  unread: number;
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
