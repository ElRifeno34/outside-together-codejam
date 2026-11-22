// Maps backend activity types (uuid ids) onto the local photo/pictogram keys used by
// activityImages / activityIcons in components/activity-card.tsx.

type VisualEntry = { key: string; name: string; niche_value: number; keywords: string[] };

/** Known activity names and keywords, each with the visual key it should use. */
const visualCatalog: VisualEntry[] = [
  { key: "walk", name: "Walk", niche_value: 1, keywords: ["walk", "balade", "marche"] },
  { key: "basketball", name: "Basketball", niche_value: 1, keywords: ["basketball", "basket"] },
  { key: "study", name: "Study outside", niche_value: 2, keywords: ["study", "étude", "réviser"] },
  { key: "chess", name: "Chess", niche_value: 3, keywords: ["chess", "échecs"] },
  { key: "photo", name: "Photo walk", niche_value: 4, keywords: ["photography", "photo"] },
  { key: "sketch", name: "Urban sketching", niche_value: 5, keywords: ["sketch", "dessin"] },
  { key: "picnic", name: "Picnic", niche_value: 1, keywords: ["picnic", "pique-nique"] },
  {
    key: "coffee",
    name: "Coffee & a stroll",
    niche_value: 1,
    keywords: ["coffee", "café", "cafe"],
  },
  { key: "jog", name: "Easy jog", niche_value: 1, keywords: ["jog", "course", "courir"] },
  {
    key: "sunset",
    name: "Watch the sunset",
    niche_value: 2,
    keywords: ["sunset", "coucher de soleil"],
  },
  {
    key: "neighbourhood",
    name: "Neighbourhood wander",
    niche_value: 2,
    keywords: ["neighbourhood", "quartier", "ruelle"],
  },
  {
    key: "bird",
    name: "Birdwatching",
    niche_value: 3,
    keywords: ["birdwatch", "oiseaux", "ornithologie"],
  },
  {
    key: "geocache",
    name: "Geocaching",
    niche_value: 4,
    keywords: ["geocach", "géocach", "treasure", "trésor"],
  },
  {
    key: "origami",
    name: "Park origami",
    niche_value: 4,
    keywords: ["origami", "paper folding", "pliage"],
  },
  {
    key: "moss",
    name: "Moss & lichen spotting",
    niche_value: 5,
    keywords: ["moss", "lichen", "mousse"],
  },
  {
    key: "sound",
    name: "City sound safari",
    niche_value: 5,
    keywords: ["sound", "sonore", "écoute", "ecoute"],
  },
];

/** Picks the local photo/icon key for an activity type, by exact name, then by keyword. */
export function visualKind(name: string, keywords: string[] = []): string {
  const words = [name, ...keywords].map((w) => w.toLowerCase());
  const exact = visualCatalog.find((t) => t.name.toLowerCase() === words[0]);
  if (exact) return exact.key;
  // Several types can share a word ("Photo walk" contains "walk"): prefer the most niche one.
  const match = visualCatalog
    .filter((t) => t.keywords.some((k) => words.some((w) => w.includes(k.toLowerCase()))))
    .sort((a, b) => b.niche_value - a.niche_value)[0];
  return match?.key ?? "walk";
}
