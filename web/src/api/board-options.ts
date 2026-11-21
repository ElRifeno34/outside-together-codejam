import type { ActivityBoardRow } from "@/data/fixtures";
import { distanceMeters } from "@/data/place-discovery";
export type NicheSort = "soonest" | "most-niche" | "least-niche" | "nearest";
/** A rounded position kept in memory only; never sent to the backend. */
export type Origin = { lat: number; lng: number };
export function selectBoardRows(
  rows: ActivityBoardRow[],
  level: number | null,
  sort: NicheSort,
  origin: Origin | null = null,
): ActivityBoardRow[] {
  return rows
    .filter((r) => level === null || r.niche_value === level)
    .sort((a, b) => {
      const difference =
        sort === "most-niche"
          ? b.niche_value - a.niche_value
          : sort === "least-niche"
            ? a.niche_value - b.niche_value
            : sort === "nearest" && origin
              ? distanceMeters(origin, a) - distanceMeters(origin, b)
              : 0;
      return difference || a.starts_at.localeCompare(b.starts_at);
    });
}
/** Asks the browser for one position (only after the person picks "Nearest first"). */
export function locateOnce(): Promise<Origin> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        // ~100 m precision is enough to sort by distance and avoids holding an exact position.
        resolve({
          lat: Math.round(coords.latitude * 1000) / 1000,
          lng: Math.round(coords.longitude * 1000) / 1000,
        }),
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? "Location permission denied. Showing soonest first."
              : "Location is unavailable. Showing soonest first.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}
