import { useLanguage } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Compass, LocateFixed, MapPin, Navigation, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { activityImages } from "@/components/activity-card";
import { locateOnce } from "@/api/board-options";
import { distanceMeters, locatePrecise } from "@/lib/geo";
import type { Spot } from "@/lib/types";
import * as api from "@/api";

const spotsOptions = queryOptions({ queryKey: ["spots"], queryFn: () => api.getSpots() });

export const Route = createFileRoute("/places")({
  loader: ({ context }) => context.queryClient.ensureQueryData(spotsOptions).catch(() => []),
  head: () => ({
    meta: [
      { title: "Places to visit · Outside Together" },
      {
        name: "description",
        content:
          "Montréal places to discover, from the classics to the very niche. Each visit earns points.",
      },
    ],
  }),
  component: PlacesPage,
});

/** 10 + 5 × niche level, the same rule as activities (points_for in the database). */
const pointsFor = (niche: number) => 10 + 5 * niche;

type Show = "all" | "todo" | "visited";

function PlacesPage() {
  const { tr } = useLanguage();
  const { profile, openAuth, refreshProfile } = useApp();
  const client = useQueryClient();
  const spots = useQuery(spotsOptions);
  const visits = useQuery({
    queryKey: ["spot-visits", profile?.id],
    queryFn: () => api.getMyVisits(),
    enabled: !!profile,
  });
  const [niche, setNiche] = useState(0);
  const [show, setShow] = useState<Show>("all");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const visited = useMemo(
    () => new Map((visits.data ?? []).map((v) => [v.spot_id, v])),
    [visits.data],
  );
  const earned = (visits.data ?? []).reduce((n, v) => n + v.points, 0);
  // Levels that exist in the catalogue (places go up to niche 6).
  const levels = useMemo(
    () => [...new Set((spots.data ?? []).map((s) => s.niche_value))].sort((a, b) => a - b),
    [spots.data],
  );
  const list = useMemo(() => {
    const rows = (spots.data ?? [])
      .filter((s) => !niche || s.niche_value === niche)
      .filter((s) => show === "all" || (show === "visited") === visited.has(s.id))
      .map((s) => ({ spot: s, meters: origin ? distanceMeters(origin, s) : null }));
    return origin ? rows.sort((a, b) => a.meters! - b.meters!) : rows;
  }, [spots.data, niche, show, visited, origin]);

  const nearMe = async () => {
    setLocating(true);
    try {
      setOrigin(await locateOnce());
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Location is unavailable"));
    } finally {
      setLocating(false);
    }
  };

  const visit = async (spot: Spot) => {
    if (!profile) return openAuth();
    setBusy(spot.id);
    try {
      const at = await locatePrecise();
      const result = await api.visitSpot(spot.id, at);
      toast.success(`${tr("You found")} ${spot.name}! +${result.points_earned} ${tr("points")}`);
      await client.invalidateQueries({ queryKey: ["spot-visits"] });
      await client.invalidateQueries({ queryKey: ["leaderboard"] });
      await refreshProfile();
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="page-width places-page">
      <div className="page-title">
        <div className="eyebrow">
          <Compass size={15} /> {tr("Places to visit")}
        </div>
        <h1>{tr("Go somewhere new.")}</h1>
        <p>
          {tr(
            "Each place pays once: 10 + 5 × its niche level, when you're within 200 m. The more niche, the more points.",
          )}
        </p>
      </div>

      {profile && spots.data && (
        <div className="spot-summary" role="status">
          <span>
            <strong>{visited.size}</strong> / {spots.data.length} {tr("places visited")}
          </span>
          <span>
            <Sparkles size={15} /> <strong>{earned}</strong> {tr("points from visits")}
          </span>
        </div>
      )}

      <div className="spot-filters">
        <div className="spot-chips" role="group" aria-label={tr("Niche level")}>
          {[0, ...levels].map((n) => (
            <Button key={n} variant="pill" data-active={niche === n} onClick={() => setNiche(n)}>
              {n === 0 ? tr("All levels") : `${tr("Niche")} ${n}`}
            </Button>
          ))}
        </div>
        <div className="spot-filters-right">
          {profile && (
            <select
              className="filter-select"
              aria-label={tr("Show")}
              value={show}
              onChange={(e) => setShow(e.target.value as Show)}
            >
              <option value="all">{tr("All places")}</option>
              <option value="todo">{tr("Not visited yet")}</option>
              <option value="visited">{tr("Visited places")}</option>
            </select>
          )}
          <Button variant="outline" onClick={() => void nearMe()} disabled={locating}>
            <LocateFixed />
            {tr(
              locating ? "Finding your location…" : origin ? "Refresh location" : "Nearest first",
            )}
          </Button>
        </div>
      </div>

      {spots.isError ? (
        <div className="empty-state">
          <h2>{tr("Places to visit aren't set up yet.")}</h2>
          <p>{tr("Run migration 013 in Supabase, then reload.")}</p>
        </div>
      ) : list.length === 0 && !spots.isLoading ? (
        <div className="empty-state">
          <h2>{tr("Nothing here with these filters.")}</h2>
        </div>
      ) : (
        <div className="spot-grid">
          {list.map(({ spot, meters }) => {
            const done = visited.get(spot.id);
            return (
              <article className="spot-card" key={spot.id} data-visited={!!done}>
                <div className="spot-photo">
                  <img src={activityImages[spot.photo] ?? activityImages["walk"]} alt="" />
                  <span className="spot-niche" data-level={spot.niche_value}>
                    {tr("Niche")} {spot.niche_value}
                  </span>
                </div>
                <div className="spot-body">
                  <h2>{spot.name}</h2>
                  <p className="spot-area">
                    <MapPin size={13} />
                    {spot.area ?? "Montréal"}
                    {meters !== null && (
                      <span className="spot-distance">
                        {" · "}
                        {meters < 1000
                          ? `${Math.round(meters / 10) * 10} m`
                          : `${(meters / 1000).toFixed(1)} km`}
                      </span>
                    )}
                  </p>
                  <p className="spot-text">{tr(spot.description)}</p>
                  <div className="spot-actions">
                    {done ? (
                      <span className="spot-done">
                        <Check size={15} /> {tr("Visited")} · +{done.points}
                      </span>
                    ) : (
                      <Button onClick={() => void visit(spot)} disabled={busy !== null}>
                        {busy === spot.id
                          ? tr("Checking your location…")
                          : `${tr("I'm here")} · +${pointsFor(spot.niche_value)}`}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={`https://www.openstreetmap.org/directions?to=${spot.lat}%2C${spot.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${tr("Directions to")} ${spot.name}`}
                      >
                        <Navigation />
                      </a>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!profile && (
        <p className="spot-signin">
          {tr("Sign in with Google to collect points at these places.")}{" "}
          <Button variant="link" onClick={() => openAuth()}>
            {tr("Sign in")}
          </Button>
        </p>
      )}
    </main>
  );
}
