export interface ActivityChallenge {
  id: string;
  title: string;
  description: string;
  points: number;
  niche: number;
}
export interface ChatMessage {
  id: string;
  activity_id: string;
  user_id: string;
  display_name: string;
  body: string;
  seeded: boolean;
}
export interface ChallengeCompletion {
  activity_id: string;
  user_id: string;
  challenge_id: string;
}
export type ReviewStatus = "pending" | "approved" | "rejected";
export interface ApprovalRequest {
  id: string;
  activity_id: string;
  user_id: string;
  kind: "attendance" | "task";
  challenge_id?: string;
  status: ReviewStatus;
  reviewed_by?: string;
  reason?: string;
}
// Demo-only role records; production permissions require server-side authentication.
export const demoRoles = [{ user_id: "sami", role: "admin" as const }];
const tasks: Record<string, [string, string]> = {
  walk: [
    "Tiny architecture hunt",
    "Find three different doorway styles and compare your favourites.",
  ],
  basketball: ["The off-hand challenge", "Make three baskets using your non-dominant hand."],
  study: [
    "Teach a curious fact",
    "Explain one surprising thing from your subject to someone in the group.",
  ],
  chess: ["Knight-only finish", "Set up and solve a knight fork puzzle with another player."],
  photo: [
    "Reflections only",
    "Take three photos of the city reflected in water, windows, or metal.",
  ],
  sketch: ["One-line skyline", "Draw the skyline without lifting your pen, then swap sketches."],
  picnic: [
    "Blind flavour detective",
    "With a willing partner, identify a snack by smell. Check allergies first.",
  ],
  coffee: [
    "Café sound map",
    "Sketch where five different sounds are coming from around your coffee stop.",
  ],
  jog: [
    "Street-name story",
    "Pause at a street sign and invent a short story about its name together.",
  ],
  sunset: [
    "Five-minute colour diary",
    "Record three colour changes in the sky without looking directly at the sun.",
  ],
  neighbourhood: [
    "Hidden lettering hunt",
    "Find three unusual signs or old shop lettering on public streets.",
  ],
  bird: [
    "Birdsong detective",
    "Listen quietly and distinguish three different bird calls without disturbing wildlife.",
  ],
  geocache: [
    "Leave a tiny riddle",
    "Solve a public cache clue together and write a riddle about the search.",
  ],
  origami: [
    "Pocket paper menagerie",
    "Fold two different paper animals and teach one fold to your group.",
  ],
  moss: [
    "Micro-forest field notes",
    "Sketch three moss or lichen textures. Observe without touching or collecting.",
  ],
  sound: [
    "A city in sixty seconds",
    "Listen for a minute and draw a sound score using symbols instead of words.",
  ],
};
export function challengesFor(typeId: string, niche: number): ActivityChallenge[] {
  const task = tasks[typeId] ?? tasks["walk"];
  if (!task) return [];
  return [
    {
      id: `${typeId}-curiosity`,
      title: task[0],
      description: task[1],
      points: 10 + 5 * niche,
      niche,
    },
    {
      id: "shared-discovery",
      title: "Trade a hidden gem",
      description:
        "Each share a lesser-known public place in Montréal and choose one for a future outing.",
      points: 10,
      niche: 2,
    },
  ];
}
export const demoPeople = [
  { name: "Camille", bio: "Always looking for a little urban discovery." },
  { name: "Alex", bio: "Here for fresh air and good company." },
  { name: "Jules", bio: "Curious about art, nature, and everything between." },
  { name: "Robin", bio: "A Montréal local with a soft spot for parks." },
  { name: "Charlie", bio: "Trying something new, one hour at a time." },
  { name: "Lou", bio: "Happy to meet fellow outdoor explorers." },
];
