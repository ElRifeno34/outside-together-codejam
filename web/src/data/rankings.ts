import type { Profile } from "./fixtures";
export type RankingScope = "friends" | "city" | "country" | "world";
export interface RankingPerson extends Profile {
  city: string;
  country: string;
}
export interface RankingEntry extends RankingPerson {
  rank: number;
}
export const rankingLocations: Record<string, { city: string; country: string }> = {
  lea: { city: "Montréal", country: "Canada" },
  sami: { city: "Montréal", country: "Canada" },
  noa: { city: "Montréal", country: "Canada" },
};
export const rankingFixtures: RankingPerson[] = [
  { id: "maya", display_name: "Maya", total_points: 180, city: "Montréal", country: "Canada" },
  {
    id: "olivier",
    display_name: "Olivier",
    total_points: 135,
    city: "Montréal",
    country: "Canada",
  },
  { id: "amelia", display_name: "Amelia", total_points: 210, city: "Toronto", country: "Canada" },
  { id: "felix", display_name: "Félix", total_points: 95, city: "Québec City", country: "Canada" },
  { id: "ines", display_name: "Inès", total_points: 260, city: "Paris", country: "France" },
  { id: "jules", display_name: "Jules", total_points: 180, city: "Lyon", country: "France" },
  {
    id: "alex",
    display_name: "Alex",
    total_points: 225,
    city: "New York",
    country: "United States",
  },
];
export const demoFriendships: Record<string, string[]> = {
  lea: ["sami", "noa", "maya"],
  sami: ["lea", "noa", "olivier"],
  noa: ["lea", "sami"],
};
