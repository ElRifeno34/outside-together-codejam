import type { Place } from "./fixtures";
export interface DiscoveryPlace extends Place {
  niche_value: number;
  highlight: string;
  image_type: string;
}
export const placeDetails: Record<
  string,
  { niche_value: number; highlight: string; image_type: string }
> = {
  lafontaine: {
    niche_value: 1,
    highlight: "A familiar park, ponds, and a quiet bench break.",
    image_type: "walk",
  },
  court: {
    niche_value: 1,
    highlight: "An everyday stop for a little basketball.",
    image_type: "basketball",
  },
  square: {
    niche_value: 2,
    highlight: "A downtown square for people-watching and public art.",
    image_type: "photo",
  },
  royal: {
    niche_value: 3,
    highlight: "Look for tiny forest textures along the public paths.",
    image_type: "bird",
  },
  oldport: {
    niche_value: 4,
    highlight: "Listen for unusual harbour sounds and spot water reflections.",
    image_type: "photo",
  },
  canal: {
    niche_value: 2,
    highlight: "A riverside pause beside the Atwater footbridge.",
    image_type: "sunset",
  },
  jean: {
    niche_value: 1,
    highlight: "A neighbourhood park for a picnic or an easy stroll.",
    image_type: "picnic",
  },
  squarelouis: {
    niche_value: 4,
    highlight: "Spot ornate doorways and hidden architectural details.",
    image_type: "sketch",
  },
  verdun: {
    niche_value: 3,
    highlight: "Watch riverside birds without disturbing wildlife.",
    image_type: "bird",
  },
  promenade: {
    niche_value: 5,
    highlight: "Collect a visual story of unusual lettering along the public route.",
    image_type: "sketch",
  },
};
export interface LocationFix {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}
export const VISIT_RADIUS_METERS = 150;
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad;
  const dlng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export interface PlaceVisit {
  user_id: string;
  place_id: string;
  points: number;
  credits: number;
  visited_at: string;
}
