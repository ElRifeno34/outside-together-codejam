import { useLanguage } from "@/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import type { Map as LeafletMap, LayerGroup, CircleMarker, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { activityPhoto, formatStart } from "@/components/activity-card";
import { activityTitle, type ActivityBoardRow } from "@/lib/types";
import { locateOnce } from "@/api/board-options";
import { distanceMeters } from "@/lib/geo";
import * as api from "@/api";
import { toast } from "sonner";

const boardOptions = queryOptions({ queryKey: ["board"], queryFn: () => api.getBoard() });

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Activity map · Outside Together" },
      { name: "description", content: "See what's happening around Montréal on a live map." },
    ],
  }),
  component: MapPage,
});

/** Montréal, roughly Plateau / downtown. */
const START: [number, number] = [45.515, -73.58];

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

type PlaceGroup = { id: string; name: string; lat: number; lng: number; rows: ActivityBoardRow[] };

function groupByPlace(rows: ActivityBoardRow[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const row of rows) {
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
    if (row.status === "cancelled" || row.status === "done") continue;
    const g = groups.get(row.place_id) ?? {
      id: row.place_id,
      name: row.place_name,
      lat: row.lat,
      lng: row.lng,
      rows: [],
    };
    g.rows.push(row);
    groups.set(row.place_id, g);
  }
  for (const g of groups.values()) g.rows.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return [...groups.values()];
}

function MapPage() {
  const { tr, language } = useLanguage();
  const navigate = useNavigate();
  const board = useQuery(boardOptions);
  const places = useMemo(() => groupByPlace(board.data ?? []), [board.data]);
  const count = places.reduce((n, p) => n + p.rows.length, 0);

  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const pins = useRef<LayerGroup | null>(null);
  const me = useRef<CircleMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const markers = useRef(new Map<string, Marker>());
  // Where "near" is measured from: the person once they tap "Near me", otherwise central Montréal.
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const nearby = useMemo(() => {
    const from = origin ?? { lat: START[0], lng: START[1] };
    return places
      .flatMap((p) => p.rows.map((r) => ({ row: r, meters: distanceMeters(from, p) })))
      .sort((a, b) => a.meters - b.meters || a.row.starts_at.localeCompare(b.row.starts_at))
      .slice(0, 6);
  }, [places, origin]);
  const showOnMap = (placeId: string, lat: number, lng: number) => {
    map.current?.flyTo([lat, lng], 16);
    markers.current.get(placeId)?.openPopup();
    el.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Leaflet needs `window`, so it is loaded in the browser only (pages also render on the server).
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { zoomControl: false }).setView(START, 13);
      L.control.zoom({ position: "bottomright" }).addTo(m);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      pins.current = L.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Popup links navigate inside the app instead of reloading the page.
  useEffect(() => {
    const root = el.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-activity]");
      if (!link) return;
      e.preventDefault();
      void navigate({ to: "/activity/$id", params: { id: link.dataset["activity"]! } });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [navigate]);

  // One Snap Map–style bubble per place: the next activity's photo plus a count badge.
  useEffect(() => {
    if (!ready || !pins.current || !map.current) return;
    void import("leaflet").then((L) => {
      const layer = pins.current!;
      layer.clearLayers();
      markers.current.clear();
      for (const place of places) {
        const next = place.rows[0];
        if (!next) continue;
        const photo = activityPhoto(next);
        const soon = new Date(next.starts_at).getTime() - Date.now() < 2 * 3600_000;
        const icon = L.divIcon({
          className: "snap-pin-wrap",
          html: `<div class="snap-pin${soon ? " is-soon" : ""}">
              <img src="${photo}" alt="" />
              ${place.rows.length > 1 ? `<span class="snap-pin-count">${place.rows.length}</span>` : ""}
            </div>`,
          iconSize: [52, 52],
          iconAnchor: [26, 26],
          popupAnchor: [0, -26],
        });
        const items = place.rows
          .slice(0, 5)
          .map((r) => {
            const spots =
              r.available_spots > 0
                ? `${r.available_spots} ${tr(r.available_spots === 1 ? "spot left" : "spots left")}`
                : tr("Full");
            return `<a class="snap-pop-item" href="/activity/${encodeURIComponent(r.id)}" data-activity="${escapeHtml(r.id)}">
                <strong>${escapeHtml(tr(activityTitle(r)))}</strong>
                <span>${escapeHtml(formatStart(r.starts_at, language))} · ${escapeHtml(spots)}</span>
              </a>`;
          })
          .join("");
        const more =
          place.rows.length > 5
            ? `<p class="snap-pop-more">+${place.rows.length - 5} ${escapeHtml(tr("more"))}</p>`
            : "";
        const marker = L.marker([place.lat, place.lng], { icon, title: place.name })
          .bindPopup(
            `<div class="snap-pop"><p class="snap-pop-place">${escapeHtml(place.name)}</p>${items}${more}</div>`,
            { closeButton: false, maxWidth: 280 },
          )
          .addTo(layer);
        markers.current.set(place.id, marker);
      }
    });
  }, [ready, places, language, tr]);

  const locate = async () => {
    setLocating(true);
    try {
      const at = await locateOnce();
      setOrigin(at);
      const L = await import("leaflet");
      if (!map.current) return;
      me.current?.remove();
      me.current = L.circleMarker([at.lat, at.lng], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#2f7bf6",
        fillOpacity: 1,
      }).addTo(map.current);
      map.current.flyTo([at.lat, at.lng], 15);
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Location is unavailable"));
    } finally {
      setLocating(false);
    }
  };

  return (
    <main className="map-page">
      <div className="map-head page-width">
        <div>
          <h1>{tr("Activity map")}</h1>
          <p>
            {board.isLoading
              ? tr("Loading activities…")
              : `${count} ${tr(count === 1 ? "activity" : "activities")} · ${places.length} ${tr(places.length === 1 ? "place" : "places")}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => void locate()} disabled={locating}>
          <LocateFixed />
          {tr(locating ? "Finding your location…" : "Near me")}
        </Button>
      </div>
      <div className="map-frame">
        <div ref={el} className="map-canvas" role="region" aria-label={tr("Activity map")} />
        {board.isError && <p className="map-overlay">{tr("Couldn't load activities")}</p>}
        {!board.isLoading && !board.isError && places.length === 0 && (
          <p className="map-overlay">{tr("No upcoming activities on the map yet")}</p>
        )}
      </div>
      {nearby.length > 0 && (
        <section className="nearby page-width" aria-labelledby="nearby-title">
          <div className="nearby-head">
            <h2 id="nearby-title">{tr(origin ? "Near you" : "Near the centre of Montréal")}</h2>
            {!origin && <p>{tr("Tap “Near me” to sort by your location.")}</p>}
          </div>
          <ul className="nearby-list">
            {nearby.map(({ row, meters }) => (
              <li key={row.id}>
                <Link to="/activity/$id" params={{ id: row.id }} className="nearby-item">
                  <img src={activityPhoto(row)} alt="" />
                  <span className="nearby-text">
                    <strong>{tr(activityTitle(row))}</strong>
                    <span>
                      {tr(row.place_name)} · {formatStart(row.starts_at, language)}
                    </span>
                  </span>
                  <span className="nearby-distance">
                    {meters < 1000
                      ? `${Math.round(meters / 10) * 10} m`
                      : `${(meters / 1000).toFixed(1)} km`}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${tr("Show on map")}: ${tr(row.place_name)}`}
                  onClick={() => showOnMap(row.place_id, row.lat, row.lng)}
                >
                  <MapPin />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
