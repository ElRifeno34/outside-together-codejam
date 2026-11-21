import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  MapPin,
  Shuffle,
  ArrowUpRight,
  ArrowLeft,
  Bookmark,
  Check,
  LocateFixed,
  Info,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "@/api";
import type { Place } from "@/data/fixtures";
import { useLanguage } from "@/i18n";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { activityImages } from "@/components/activity-card";
import { creditsFor } from "@/data/rewards";
import { distanceMeters, VISIT_RADIUS_METERS, type LocationFix } from "@/data/place-discovery";
import "@/components/place-visits.css";
const placeOptions = queryOptions({ queryKey: ["public-places"], queryFn: api.getPublicPlaces });
export const Route = createFileRoute("/places")({
  loader: async ({ context }) => ({
    places: await context.queryClient.ensureQueryData(placeOptions),
  }),
  head: () => ({
    meta: [
      { title: "Montréal places to visit · Outside Together" },
      {
        name: "description",
        content:
          "Discover public Montréal parks, squares, and riverside paths for a spontaneous one-hour outing.",
      },
      { property: "og:title", content: "Montréal places to visit · Outside Together" },
      {
        property: "og:description",
        content:
          "Save Montréal places, find nearby discoveries with your location, and earn niche-level demo visit rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlacesPage,
});
function PlacesPage() {
  const { tr } = useLanguage();
  const { profile, openAuth, refreshProfile } = useApp();
  const { places } = Route.useLoaderData();
  const [pick, setPick] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [tab, setTab] = useState("all");
  const [niche, setNiche] = useState("");
  const [checking, setChecking] = useState<string | null>(null);
  const my = useQuery({
    queryKey: ["my-places", profile?.id],
    queryFn: api.getMyPlaces,
    enabled: !!profile,
  });
  const locate = (): Promise<LocationFix> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is unavailable"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          }),
        (error) =>
          reject(
            new Error(
              error.code === 1
                ? "Location permission denied. You can still save and browse places."
                : error.code === 3
                  ? "Location request timed out. Try again."
                  : "Location is unavailable",
            ),
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  const updateLocation = async () => {
    setLocating(true);
    setLocationError("");
    try {
      const fix = await locate();
      setLocation(fix);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Location is unavailable");
    } finally {
      setLocating(false);
    }
  };
  const displayed = places
    .filter(
      (p) =>
        (!niche || p.niche_value === Number(niche)) &&
        (tab === "all" ||
          (tab === "saved" && my.data?.saved.includes(p.id)) ||
          (tab === "visited" && my.data?.visits.some((v) => v.place_id === p.id))),
    )
    .sort((a, b) => (location ? distanceMeters(location, a) - distanceMeters(location, b) : 0));
  return (
    <main className="page-width">
      <div className="page-title">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} />
          {tr("Back to activities")}
        </Link>
        <div className="eyebrow mt-7">
          <MapPin size={14} />
          {tr("Public Montréal places")}
        </div>
        <h1>{tr("My Places")}</h1>
        <p>{tr("Save a little discovery. Visit somewhere unexpected.")}</p>
      </div>
      <div className="place-toolbar">
        <span>
          {places.length} {tr("Places to visit")}
        </span>
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setPick(await api.getRandomPlace(pick?.id));
            } catch (e) {
              toast.error(tr(e instanceof Error ? e.message : "Please try again"));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Shuffle />
          {tr("Surprise place")}
        </Button>
      </div>
      {pick && (
        <section className="random-place" aria-label={tr("Your random pick")}>
          <div>
            <div className="eyebrow">{tr("Your random pick")}</div>
            <h2>{tr(pick.name)}</h2>
            <p>{pick.address}</p>
          </div>
          <Button asChild>
            <Link to="/create" search={{ place: pick.id }}>
              {tr("Plan an hour here")}
              <ArrowUpRight />
            </Link>
          </Button>
        </section>
      )}
      <div className="places-discovery-tools" role="group" aria-label={tr("Place filters")}>
        {[
          { id: "all", label: "All places" },
          { id: "saved", label: "Saved places" },
          { id: "visited", label: "Visited places" },
        ].map(({ id, label }) => (
          <Button
            key={id}
            variant={tab === id ? "default" : "outline"}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {tr(label)}
          </Button>
        ))}
        <Button variant="outline" disabled={locating} onClick={() => void updateLocation()}>
          <LocateFixed />
          {tr(
            locating ? "Finding your location…" : location ? "Refresh location" : "Use my location",
          )}
        </Button>
        <select
          className="filter-select"
          aria-label={tr("Place niche level")}
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        >
          <option value="">{tr("All levels")}</option>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              {tr("Niche level")} {level}/5
            </option>
          ))}
        </select>
      </div>
      <p className="places-location-status">
        <Info size={15} />
        {tr(
          "Demo visits · within 150 m, precise device location, one reward per place. Coordinates are not saved.",
        )}
      </p>
      {location && (
        <p className="places-location-status">
          <LocateFixed size={14} />
          {tr("Nearest places first")} · ±{Math.round(location.accuracy)} m
        </p>
      )}
      {locationError && (
        <p role="alert" className="review-reason">
          {tr(locationError)}
        </p>
      )}
      {profile && (
        <div className="my-place-stats">
          <span>
            <strong>{my.data?.saved.length ?? 0}</strong>
            {tr("saved")}
          </span>
          <span>
            <strong>{my.data?.visits.length ?? 0}</strong>
            {tr("visited")}
          </span>
        </div>
      )}
      {my.isError && (
        <p role="alert">
          {tr("Couldn’t load your places.")}{" "}
          <Button variant="link" onClick={() => void my.refetch()}>
            {tr("Try again")}
          </Button>
        </p>
      )}
      {!profile && tab !== "all" ? (
        <div className="empty-state">
          <Bookmark />
          <p>{tr("Sign in to save places and earn visit rewards.")}</p>
          <Button onClick={() => openAuth()}>{tr("Sign in")}</Button>
        </div>
      ) : (
        <div className="visit-grid">
          {displayed.map((p) => {
            const saved = my.data?.saved.includes(p.id) ?? false;
            const visit = my.data?.visits.find((v) => v.place_id === p.id);
            const distance = location ? distanceMeters(location, p) : null;
            const points = 10 + 5 * p.niche_value;
            const save = async () => {
              try {
                await api.savePlace(p.id, !saved);
                await my.refetch();
              } catch (error) {
                toast.error(tr(error instanceof Error ? error.message : "Please try again"));
              }
            };
            return (
              <article className="visit-place" key={p.id}>
                <div className="visit-place-photo">
                  <img src={activityImages[p.image_type]} alt={tr(p.name)} />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-pressed={saved}
                    aria-label={`${tr(saved ? "Unsave place" : "Save place")} · ${tr(p.name)}`}
                    title={tr(saved ? "Unsave place" : "Save place")}
                    onClick={() => (profile ? void save() : openAuth(save))}
                  >
                    <Bookmark fill={saved ? "currentColor" : "none"} />
                  </Button>
                </div>
                <div className="visit-place-body">
                  <h2>{tr(p.name)}</h2>
                  <p>{p.address}</p>
                  <p>{tr(p.highlight)}</p>
                  <div className="visit-place-meta">
                    <span>
                      {tr("Niche level")} {p.niche_value}/5
                    </span>
                    {distance !== null && (
                      <span>
                        {distance < 1000
                          ? `${Math.round(distance)} m`
                          : `${(distance / 1000).toFixed(1)} km`}
                      </span>
                    )}
                  </div>
                  <div className="visit-place-reward">
                    <Sparkles size={14} />
                    <span>
                      +{points} {tr("pts")}
                    </span>
                    <span>
                      +{creditsFor(points, p.niche_value)} {tr("credits")}
                    </span>
                  </div>
                  <Button
                    variant={visit ? "secondary" : "outline"}
                    disabled={!!visit || checking !== null || locating}
                    onClick={() => {
                      const checkIn = async () => {
                        setChecking(p.id);
                        setLocationError("");
                        try {
                          const fix = await locate();
                          setLocation(fix);
                          const result = await api.checkInPlace(p.id, fix);
                          await refreshProfile();
                          toast.success(
                            `+${result.points} ${tr("pts")} · +${result.credits} ${tr("credits")}`,
                          );
                        } catch (error) {
                          const message =
                            error instanceof Error ? error.message : "Location is unavailable";
                          setLocationError(message);
                          toast.error(tr(message));
                        } finally {
                          setChecking(null);
                        }
                      };
                      if (profile) void checkIn();
                      else openAuth(checkIn);
                    }}
                  >
                    {visit ? (
                      <>
                        <Check />
                        {tr("Visit rewarded")}
                      </>
                    ) : checking === p.id ? (
                      tr("Checking your location…")
                    ) : (
                      <>
                        <LocateFixed />
                        {tr("Check in here")}
                      </>
                    )}
                  </Button>
                  {distance !== null && distance > VISIT_RADIUS_METERS && (
                    <p>{tr("Get within 150 m of this place to check in")}</p>
                  )}
                  <Link className="visit-plan-link" to="/create" search={{ place: p.id }}>
                    {tr("Plan an hour here")}
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </article>
            );
          })}
          {displayed.length === 0 && (
            <div className="empty-state">
              <MapPin />
              <p>
                {tr(
                  tab === "saved"
                    ? "Your saved discoveries will appear here."
                    : tab === "visited"
                      ? "Your rewarded visits will appear here."
                      : "No places match this level.",
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
