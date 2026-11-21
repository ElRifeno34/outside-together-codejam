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
  creator_id: string;
  /** Local photo/icon key. Fixture rows use their type_id; Supabase rows map the type name. */
  kind?: string;
  /** Caller's registration from activity_board.my_status (Supabase mode only). */
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
  avatar_frame?: string;
  profile_badge?: string;
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
  challenge_id?: string;
  challenge_title?: string;
  place_id?: string;
  place_name?: string;
  created_at: string;
}
export const activityTypes: ActivityType[] = [
  { id: "walk", name: "Walk", niche_value: 1, keywords: ["walk", "balade", "marche"] },
  { id: "basketball", name: "Basketball", niche_value: 1, keywords: ["basketball", "basket"] },
  { id: "study", name: "Study outside", niche_value: 2, keywords: ["study", "étude", "réviser"] },
  { id: "chess", name: "Chess", niche_value: 3, keywords: ["chess", "échecs"] },
  { id: "photo", name: "Photo walk", niche_value: 4, keywords: ["photography", "photo"] },
  { id: "sketch", name: "Urban sketching", niche_value: 5, keywords: ["sketch", "dessin"] },
  { id: "picnic", name: "Picnic", niche_value: 1, keywords: ["picnic", "pique-nique"] },
  { id: "coffee", name: "Coffee & a stroll", niche_value: 1, keywords: ["coffee", "café", "cafe"] },
  { id: "jog", name: "Easy jog", niche_value: 1, keywords: ["jog", "course", "courir"] },
  {
    id: "sunset",
    name: "Watch the sunset",
    niche_value: 2,
    keywords: ["sunset", "coucher de soleil"],
  },
  {
    id: "neighbourhood",
    name: "Neighbourhood wander",
    niche_value: 2,
    keywords: ["neighbourhood", "quartier", "ruelle"],
  },
  {
    id: "bird",
    name: "Birdwatching",
    niche_value: 3,
    keywords: ["birdwatch", "oiseaux", "ornithologie"],
  },
  {
    id: "geocache",
    name: "Geocaching",
    niche_value: 4,
    keywords: ["geocach", "géocach", "treasure", "trésor"],
  },
  {
    id: "origami",
    name: "Park origami",
    niche_value: 4,
    keywords: ["origami", "paper folding", "pliage"],
  },
  {
    id: "moss",
    name: "Moss & lichen spotting",
    niche_value: 5,
    keywords: ["moss", "lichen", "mousse"],
  },
  {
    id: "sound",
    name: "City sound safari",
    niche_value: 5,
    keywords: ["sound", "sonore", "écoute", "ecoute"],
  },
];
export const places: Place[] = [
  {
    id: "lafontaine",
    name: "Parc La Fontaine",
    address: "3819 Av. Calixa-Lavallée, Montréal",
    lat: 45.526,
    lng: -73.569,
    is_public: true,
  },
  {
    id: "court",
    name: "McGill outdoor court",
    address: "475 Av. des Pins Ouest, Montréal",
    lat: 45.509,
    lng: -73.583,
    is_public: true,
  },
  {
    id: "square",
    name: "Place Émilie-Gamelin",
    address: "1500 Rue Berri, Montréal",
    lat: 45.515,
    lng: -73.559,
    is_public: true,
  },
  {
    id: "royal",
    name: "Parc du Mont-Royal",
    address: "1260 Chem. Remembrance, Montréal",
    lat: 45.504,
    lng: -73.587,
    is_public: true,
  },
  {
    id: "oldport",
    name: "Old Port of Montréal",
    address: "333 Rue de la Commune Ouest, Montréal",
    lat: 45.505,
    lng: -73.55,
    is_public: true,
  },
  {
    id: "private",
    name: "Private rooftop",
    address: "Private residence, Montréal",
    lat: 45.51,
    lng: -73.57,
    is_public: false,
  },
  {
    id: "canal",
    name: "Lachine Canal · Atwater footbridge",
    address: "Passerelle du marché Atwater, Montréal",
    lat: 45.479,
    lng: -73.576,
    is_public: true,
  },
  {
    id: "jean",
    name: "Parc Jarry",
    address: "205 Rue Gary-Carter, Montréal",
    lat: 45.535,
    lng: -73.628,
    is_public: true,
  },
  {
    id: "squarelouis",
    name: "Square Saint-Louis",
    address: "312 Rue du Square Saint-Louis, Montréal",
    lat: 45.517,
    lng: -73.57,
    is_public: true,
  },
  {
    id: "verdun",
    name: "Parc de l’Honorable-George-O’Reilly",
    address: "950 Bd LaSalle, Verdun, Montréal",
    lat: 45.451,
    lng: -73.569,
    is_public: true,
  },
  {
    id: "promenade",
    name: "Promenade Fleuve-Montagne",
    address: "Place d’Armes, Montréal",
    lat: 45.505,
    lng: -73.557,
    is_public: true,
  },
];
export const accounts: (Profile & { email: string })[] = [
  { id: "lea", display_name: "Léa", email: "lea@example.com", total_points: 0 },
  { id: "sami", display_name: "Sami", email: "sami@example.com", total_points: 0 },
  { id: "noa", display_name: "Noa", email: "noa@example.com", total_points: 0 },
];
export function torontoDate(date: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)?.value ?? "")
    .join("-");
}
export function torontoTime(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
}
export function localToISO(day: string, time: string): string {
  const base = new Date(`${day}T${time}:00Z`);
  if (!Number.isFinite(base.getTime())) throw new Error("Choose a valid date and time");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    timeZoneName: "longOffset",
  }).formatToParts(base);
  const offset = parts.find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return new Date(`${day}T${time}:00${offset}`).toISOString();
}
export function futureDay(offset: number, now = new Date()): string {
  const day = new Date(`${torontoDate(now)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
export function nextWeekday(index: number, now = new Date()): string {
  const today = new Date(`${torontoDate(now)}T12:00:00Z`);
  let delta = (index - today.getUTCDay() + 7) % 7;
  if (delta === 0 && new Date(localToISO(torontoDate(now), "15:00")) <= now) delta = 7;
  return futureDay(delta, now);
}
export function makeFixtures(now = new Date()) {
  const rows: ActivityBoardRow[] = [];
  const add = (
    id: string,
    typeId: string,
    placeId: string,
    starts: string,
    count: number,
    capacity = 6,
    min = 3,
  ) => {
    const type = activityTypes.find((t) => t.id === typeId);
    const place = places.find((p) => p.id === placeId);
    if (!type || !place) return;
    rows.push({
      id,
      creator_id: "noa",
      type_id: type.id,
      activity_name: type.name,
      niche_value: type.niche_value,
      place_id: place.id,
      place_name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      starts_at: starts,
      duration_min: 60,
      capacity,
      min_people: min,
      status: count >= min ? "confirmed" : "open",
      joined_count: count,
      available_spots: capacity - count,
    });
  };
  const types = [
    "walk",
    "basketball",
    "study",
    "chess",
    "photo",
    "sketch",
    "walk",
    "chess",
    "basketball",
  ];
  const locations = [
    "lafontaine",
    "court",
    "royal",
    "square",
    "oldport",
    "lafontaine",
    "royal",
    "lafontaine",
    "court",
  ];
  types.forEach((type, i) =>
    add(
      `activity-${i + 1}`,
      type,
      locations[i] ?? "lafontaine",
      new Date(now.getTime() + (i + 2) * 3 * 3600000).toISOString(),
      [3, 5, 2, 2, 3, 1, 2, 1, 3][i] ?? 2,
    ),
  );
  add("friday-basketball", "basketball", "court", localToISO(nextWeekday(5, now), "15:00"), 3);
  const extraTypes = [
    "picnic",
    "coffee",
    "jog",
    "sunset",
    "neighbourhood",
    "bird",
    "geocache",
    "origami",
    "moss",
    "sound",
    "picnic",
    "coffee",
  ];
  const extraPlaces = [
    "jean",
    "squarelouis",
    "canal",
    "verdun",
    "promenade",
    "royal",
    "jean",
    "squarelouis",
    "royal",
    "oldport",
    "lafontaine",
    "canal",
  ];
  extraTypes.forEach((type, i) =>
    add(
      `example-${i + 1}`,
      type,
      extraPlaces[i] ?? "lafontaine",
      new Date(now.getTime() + (i + 3) * 2.5 * 3600000).toISOString(),
      [2, 3, 1, 4, 2, 2, 1, 3, 1, 2, 3, 2][i] ?? 2,
    ),
  );
  add(
    "finished-basketball",
    "basketball",
    "court",
    new Date(now.getTime() - 4 * 3600000).toISOString(),
    2,
    6,
    2,
  );
  add(
    "finished-photo",
    "photo",
    "oldport",
    new Date(now.getTime() - 24 * 3600000).toISOString(),
    2,
    6,
    2,
  );
  add("private-activity", "walk", "private", new Date(now.getTime() + 3600000).toISOString(), 1);
  const participants: Participant[] = rows.flatMap((row) =>
    Array.from({ length: row.joined_count }, (_, i) => ({
      activity_id: row.id,
      user_id: row.id.startsWith("finished") ? (i === 0 ? "lea" : "sami") : `guest-${i}`,
      status: "joined" as const,
      joined_at: now.toISOString(),
    })),
  );
  return {
    rows,
    participants,
    profiles: accounts.map((a) => ({ ...a })),
    points: [] as PointsEntry[],
  };
}
