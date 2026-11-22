/** Great-circle distance in metres between two coordinates (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad;
  const dlng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type DevicePosition = { lat: number; lng: number; accuracy: number };

/**
 * One precise GPS reading, used as proof of presence for "We're here".
 * The server compares it with the place (within 200 m) and keeps it on the check-in.
 */
export function locatePrecise(): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is unavailable on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? "Allow location access to check in"
              : error.code === 3
                ? "Location request timed out. Try again."
                : "Location is unavailable on this device",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
