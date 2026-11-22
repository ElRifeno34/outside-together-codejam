// Grades, credits and how each shop item looks (migration 019).
// Prices and ownership live in the database; this file only decides how things render.

export type GradeMetal = "bronze" | "silver" | "gold" | "platinum";

export interface Grade {
  name: string;
  metal: GradeMetal;
  /** Points needed for this grade. */
  min: number;
  /** Points needed for the next grade, or null at Platinum. */
  next: number | null;
}

const LADDER: { name: string; metal: GradeMetal; min: number }[] = [
  { name: "Bronze I", metal: "bronze", min: 0 },
  { name: "Bronze II", metal: "bronze", min: 50 },
  { name: "Bronze III", metal: "bronze", min: 100 },
  { name: "Silver I", metal: "silver", min: 200 },
  { name: "Silver II", metal: "silver", min: 300 },
  { name: "Silver III", metal: "silver", min: 450 },
  { name: "Gold I", metal: "gold", min: 650 },
  { name: "Gold II", metal: "gold", min: 900 },
  { name: "Gold III", metal: "gold", min: 1200 },
  { name: "Platinum", metal: "platinum", min: 1600 },
];

/** The grade for a points total, with the threshold of the next one. */
export function gradeFor(points: number): Grade {
  let i = 0;
  while (i + 1 < LADDER.length && points >= LADDER[i + 1]!.min) i++;
  const g = LADDER[i]!;
  return { ...g, next: LADDER[i + 1]?.min ?? null };
}

/** 0–1 progress from this grade to the next (1 at Platinum). */
export function gradeProgress(points: number): number {
  const g = gradeFor(points);
  if (g.next === null) return 1;
  return Math.min(1, Math.max(0, (points - g.min) / (g.next - g.min)));
}

export const GRADES = LADDER;

/** 1 credit per 5 points (the bonus from trophies is added by the database). */
export const POINTS_PER_CREDIT = 5;

// ---- Cosmetics ------------------------------------------------------------------------------

export type ItemKind = "avatar" | "frame" | "banner" | "name_effect";

/** Illustrated avatars: an emoji on a soft gradient (no image files needed). */
export const AVATARS: Record<string, { emoji: string; background: string }> = {
  "av-squirrel": { emoji: "🐿️", background: "linear-gradient(135deg,#f6d6b8,#e8a87c)" },
  "av-fox": { emoji: "🦊", background: "linear-gradient(135deg,#ffd3a5,#fd6585)" },
  "av-owl": { emoji: "🦉", background: "linear-gradient(135deg,#c9d6ff,#8e9eab)" },
  "av-raccoon": { emoji: "🦝", background: "linear-gradient(135deg,#d7d2cc,#6c7a89)" },
  "av-beaver": { emoji: "🦫", background: "linear-gradient(135deg,#e6c9a8,#a0785a)" },
  "av-heron": { emoji: "🪶", background: "linear-gradient(135deg,#a1c4fd,#c2e9fb)" },
  "av-bear": { emoji: "🐻", background: "linear-gradient(135deg,#d4a373,#7f5539)" },
  "av-moose": { emoji: "🫎", background: "linear-gradient(135deg,#b7e4c7,#2d6a4f)" },
};

/** Banners: a gradient (and optional pattern) behind the profile header. */
export const BANNERS: Record<string, string> = {
  "bn-mountain": "linear-gradient(135deg,#1b4332 0%,#40916c 55%,#b7e4c7 100%)",
  "bn-river": "linear-gradient(135deg,#03045e 0%,#0077b6 50%,#90e0ef 100%)",
  "bn-autumn": "linear-gradient(135deg,#6a040f 0%,#dc2f02 45%,#ffba08 100%)",
  "bn-sunset": "linear-gradient(160deg,#355070 0%,#b56576 50%,#eaac8b 100%)",
  "bn-night":
    "radial-gradient(circle at 20% 30%,#fff7 0 1px,transparent 2px),radial-gradient(circle at 70% 20%,#fff6 0 1px,transparent 2px),radial-gradient(circle at 45% 60%,#fff5 0 1px,transparent 2px),linear-gradient(180deg,#0b132b 0%,#1c2541 60%,#3a506b 100%)",
  "bn-aurora": "linear-gradient(120deg,#0b3d2e 0%,#19a974 35%,#5b2a86 70%,#0b132b 100%)",
};

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  avatar: "Profile pictures",
  frame: "Avatar frames",
  banner: "Banners",
  name_effect: "Name effects",
};

export const TROPHY_TIERS = ["platinum", "gold", "silver", "bronze"] as const;
export type TrophyTier = (typeof TROPHY_TIERS)[number];
