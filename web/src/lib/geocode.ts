// Address search and reverse lookup with OpenStreetMap's Nominatim (free, no key).
// Usage policy: at most ~1 request per second and no autocomplete, so the picker only
// searches when the person submits, and reverse-looks-up once per dropped pin.
// https://operations.osmfoundation.org/policies/nominatim/
import type { ActivityLocation } from "@/api";

const NOMINATIM = "https://nominatim.openstreetmap.org";
/** Greater Montréal: west, north, east, south. */
const VIEWBOX = "-74.20,45.80,-73.30,45.30";

type NominatimHit = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
};

/** "Rue Saint-Denis 1234, Le Plateau-Mont-Royal" from Nominatim's long display name. */
function shortAddress(hit: NominatimHit): string {
  const a = hit.address ?? {};
  const road = a["road"] ?? a["pedestrian"] ?? a["footway"] ?? a["path"];
  // A house number alone (no street) means nothing to people, so drop it.
  const street = road ? [a["house_number"], road].filter(Boolean).join(" ") : "";
  const area = a["neighbourhood"] ?? a["suburb"] ?? a["city_district"] ?? a["city"] ?? "";
  return (
    [street, area].filter(Boolean).join(", ") || hit.display_name.split(",").slice(0, 3).join(",")
  );
}

function toLocation(hit: NominatimHit): ActivityLocation {
  return {
    name: (hit.name || hit.display_name.split(",")[0] || "").trim(),
    address: shortAddress(hit),
    lat: Math.round(Number(hit.lat) * 1e6) / 1e6,
    lng: Math.round(Number(hit.lon) * 1e6) / 1e6,
  };
}

/** Places and addresses in the Montréal area matching the text (up to 5). */
export async function searchLocations(
  query: string,
  language: string,
): Promise<ActivityLocation[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "ca",
    viewbox: VIEWBOX,
    bounded: "1",
    "accept-language": language,
  });
  const response = await fetch(`${NOMINATIM}/search?${params}`);
  if (!response.ok) throw new Error("Place search is unavailable. Drop a pin instead.");
  return ((await response.json()) as NominatimHit[]).map(toLocation);
}

/** Name and address of the point where a pin was dropped (best effort). */
export async function describePoint(
  lat: number,
  lng: number,
  language: string,
): Promise<ActivityLocation> {
  const fallback = { name: "", address: "", lat, lng };
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "jsonv2",
      addressdetails: "1",
      zoom: "18",
      "accept-language": language,
    });
    const response = await fetch(`${NOMINATIM}/reverse?${params}`);
    if (!response.ok) return fallback;
    const hit = (await response.json()) as NominatimHit & { error?: string };
    if (hit.error) return fallback;
    return { ...toLocation(hit), lat, lng };
  } catch {
    return fallback;
  }
}
