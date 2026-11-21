import { useLanguage } from "@/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { activityImages } from "@/components/activity-card";
import * as api from "@/api";
import { visualKind } from "@/api/supabase-backend";
import { futureDay, localToISO, torontoDate, torontoTime } from "@/data/fixtures";
import { toast } from "sonner";
const options = queryOptions({
  queryKey: ["draft-options"],
  queryFn: async () => ({
    types: await api.getActivityTypes(),
    places: await api.getPublicPlaces(),
  }),
});
export const Route = createFileRoute("/create")({
  validateSearch: z.object({
    type: z.string().optional(),
    place: z.string().optional(),
    start: z.string().optional(),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(options),
  head: () => ({
    meta: [
      { title: "Create an activity · Outside Together" },
      {
        name: "description",
        content: "Start a spontaneous one-hour activity at a public place in Montréal.",
      },
      { property: "og:title", content: "Create an activity · Outside Together" },
      {
        property: "og:description",
        content:
          "Make a little plan. Invite a little company. Review and publish your Montréal activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateActivity,
});
function CreateActivity() {
  const { tr, language } = useLanguage();
  const { data } = useSuspenseQuery(options);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { profile, openAuth, refreshProfile } = useApp();
  // Real backends use uuids: only accept a prefilled id that exists, otherwise the first option.
  const [type, setType] = useState(
    data.types.some((t) => t.id === search.type) ? search.type! : (data.types[0]?.id ?? ""),
  );
  const [place, setPlace] = useState(
    data.places.some((p) => p.id === search.place) ? search.place! : (data.places[0]?.id ?? ""),
  );
  const validStart =
    search.start && Number.isFinite(new Date(search.start).getTime()) ? search.start : null;
  const [day, setDay] = useState(validStart ? torontoDate(validStart) : futureDay(1));
  const [time, setTime] = useState(validStart ? torontoTime(validStart) : "15:00");
  const [capacity, setCapacity] = useState(6);
  const [minimum, setMinimum] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosen = data.types.find((t) => t.id === type);
  const chosenPlace = data.places.find((p) => p.id === place);
  const ready = !!chosen && !!chosenPlace;
  const publish = async () => {
    setBusy(true);
    setError("");
    try {
      const id = await api.createActivity({
        type_id: type,
        place_id: place,
        starts_at: localToISO(day, time),
        capacity,
        min_people: minimum,
      });
      await refreshProfile();
      toast.success(tr("Published! Your activity is on the board."));
      await navigate({ to: "/activity/$id", params: { id } });
    } catch (e) {
      setError(tr(e instanceof Error ? e.message : "Could not publish"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page-width">
      <div className="page-title">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} />
          {tr("Back to activities")}
        </Link>
        <h1>{tr("A little plan starts with you.")}</h1>
        <p>{tr("Review your activity, then put it out into the world.")}</p>
      </div>
      <div className="draft-layout">
        <form
          className="draft-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            if (profile) void publish();
            else openAuth(publish);
          }}
        >
          <label className="field full">
            {tr("Activity")}
            <select
              aria-label={tr("Activity")}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {data.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {tr(t.name ?? "")} {tr("· niche ")}
                  {t.niche_value}
                  {tr("/5")}
                </option>
              ))}
            </select>
          </label>
          <label className="field full">
            {tr("Public place")}
            <select
              aria-label={tr("Public place")}
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            >
              {data.places.map((p) => (
                <option key={p.id} value={p.id}>
                  {tr(p.name ?? "")}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {tr("Date")}
            <input
              required
              type="date"
              value={day}
              min={torontoDate()}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label className="field">
            {tr("Time in Montréal")}
            <input required type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="field">
            {tr("Capacity")}
            <input
              required
              type="number"
              min={2}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </label>
          <label className="field">
            {tr("Minimum people")}
            <input
              required
              type="number"
              min={2}
              max={capacity}
              value={minimum}
              onChange={(e) => setMinimum(Number(e.target.value))}
            />
          </label>
          {!ready && (
            <p className="full text-sm text-destructive" role="alert">
              {tr("No activity types or public places are available yet.")}
            </p>
          )}
          {error && (
            <p className="full text-sm text-destructive" role="alert">
              {tr(error ?? "")}
            </p>
          )}
          <p className="full text-xs text-muted-foreground">
            {tr("1 hour · You’ll be the first person registered.")}
          </p>
          <div className="form-actions full">
            <Button disabled={busy || !ready} type="submit">
              {busy ? tr("Publishing…") : tr("Publish")}
              <ArrowUpRight />
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">{tr("Cancel")}</Link>
            </Button>
          </div>
          {!profile && (
            <p className="full text-xs text-muted-foreground">
              {tr("Sign in when you’re ready to publish.")}
            </p>
          )}
        </form>
        <aside className="draft-summary">
          {chosen && (
            <img
              src={activityImages[visualKind(chosen.name, chosen.keywords)]}
              alt={tr(chosen.name)}
            />
          )}
          <h2>{tr(chosen?.name ?? "")}</h2>
          <p>
            {tr(chosenPlace?.name ?? "")}
            <br />
            {chosenPlace?.address}
          </p>
          <span className="points-label">
            <Sparkles size={15} />
            {tr("+")}
            {10 + 5 * (chosen?.niche_value ?? 1)} {tr("points after attendance")}
          </span>
          <p>{tr("Points = 10 + 5 × niche value, once 2 participants check in")}</p>
        </aside>
      </div>
    </main>
  );
}
