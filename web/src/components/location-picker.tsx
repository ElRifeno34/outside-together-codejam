import { useLanguage } from "@/i18n";
import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import type { ActivityLocation } from "@/api";
import { describePoint, searchLocations } from "@/lib/geocode";

const MONTREAL: [number, number] = [45.515, -73.58];

/**
 * Pick where an activity happens: search an address or place name, or click / drag a pin
 * on an OpenStreetMap map. The spot belongs to this activity only.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: ActivityLocation | null;
  onChange: (location: ActivityLocation | null) => void;
}) {
  const { tr, language } = useLanguage();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ActivityLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  // Dropping or dragging the pin: keep a name the person typed, otherwise describe the spot.
  const place = async (lat: number, lng: number) => {
    const rounded = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
    const typedName = latest.current?.name ?? "";
    onChange({ name: typedName, address: latest.current?.address ?? "", ...rounded });
    const found = await describePoint(rounded.lat, rounded.lng, language);
    onChange({
      name: typedName || found.name,
      address: found.address,
      ...rounded,
    });
  };

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current || map.current) return;
      const start = latest.current;
      const m = L.map(el.current).setView(
        start ? [start.lat, start.lng] : MONTREAL,
        start ? 16 : 12,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      m.on("click", (e) => void place(e.latlng.lat, e.latlng.lng));
      map.current = m;
      if (start) setPin(L, start.lat, start.lng);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      pin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once
  }, []);

  // Keep the pin where the value says (search results, edits, clearing).
  useEffect(() => {
    void import("leaflet").then((L) => {
      if (!map.current) return;
      if (!value) {
        pin.current?.remove();
        pin.current = null;
        return;
      }
      setPin(L, value.lat, value.lng);
    });
  }, [value?.lat, value?.lng, value]);

  function setPin(L: typeof import("leaflet"), lat: number, lng: number) {
    if (!map.current) return;
    if (pin.current) {
      pin.current.setLatLng([lat, lng]);
      return;
    }
    const icon = L.divIcon({
      className: "picker-pin-wrap",
      html: '<div class="picker-pin"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
    pin.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map.current);
    pin.current.on("dragend", () => {
      const at = pin.current!.getLatLng();
      void place(at.lat, at.lng);
    });
  }

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setMessage("");
    try {
      const hits = await searchLocations(query.trim(), language);
      setResults(hits);
      if (!hits.length)
        setMessage(tr("No match in the Montréal area. Try another name, or drop a pin."));
    } catch (e) {
      setMessage(
        tr(e instanceof Error ? e.message : "Place search is unavailable. Drop a pin instead."),
      );
    } finally {
      setSearching(false);
    }
  };

  const choose = (hit: ActivityLocation) => {
    setResults([]);
    onChange(hit);
    map.current?.setView([hit.lat, hit.lng], 17);
  };

  return (
    <div className="location-picker">
      <div className="picker-search" role="search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder={tr("Search a place or address in Montréal")}
          aria-label={tr("Search a place or address in Montréal")}
        />
        <Button type="button" variant="outline" onClick={() => void search()} disabled={searching}>
          <Search />
          {tr(searching ? "Searching…" : "Search")}
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="picker-results">
          {results.map((hit) => (
            <li key={`${hit.lat},${hit.lng}`}>
              <button type="button" onClick={() => choose(hit)}>
                <MapPin size={14} />
                <span>
                  <strong>{hit.name || hit.address}</strong>
                  {hit.name && <small>{hit.address}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="picker-message">{message}</p>}
      <div ref={el} className="picker-map" aria-label={tr("Map: click to drop the pin")} />
      <p className="picker-hint">
        {tr(
          "Click the map to drop the pin, then drag it to the exact spot. Check-in counts within 200 m of it.",
        )}
      </p>
      {value && (
        <label className="field">
          {tr("Name of the spot")}
          <input
            value={value.name}
            maxLength={80}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder={tr("e.g. North entrance of Parc Jarry")}
          />
          {value.address && <small className="picker-address">{value.address}</small>}
        </label>
      )}
    </div>
  );
}
