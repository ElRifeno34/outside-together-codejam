import { useLanguage } from "@/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, ImagePlus, MapPin, Sparkles, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { activityImages } from "@/components/activity-card";
import { LocationPicker } from "@/components/location-picker";
import { QuestEditor } from "@/components/quest-editor";
import type { QuestDraft } from "@/lib/types";
import * as api from "@/api";
import { activityOptions as editOptions, draftOptions as options } from "@/api/queries";
import { visualKind } from "@/lib/activity-visuals";
import { futureDay, localToISO, torontoDate, torontoTime } from "@/lib/time";
import { toast } from "sonner";
export const Route = createFileRoute("/create")({
  validateSearch: z.object({
    type: z.string().optional(),
    place: z.string().optional(),
    start: z.string().optional(),
    /** Editing an existing activity (its id) instead of creating one. */
    edit: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ edit: search.edit }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(options);
    if (deps.edit) await context.queryClient.ensureQueryData(editOptions(deps.edit));
  },
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
  // Editing: the loader already fetched the activity, so its values are here on first render.
  const editing = useQuery({ ...editOptions(search.edit ?? ""), enabled: !!search.edit }).data;
  const editId = search.edit && editing ? search.edit : null;
  const prefill = {
    type: editing?.type_id ?? search.type,
    place: editing?.place_id ?? search.place,
    start: editing?.starts_at ?? search.start,
  };
  // Real backends use uuids: only accept a prefilled id that exists, otherwise the first option.
  const [type, setType] = useState(
    data.types.some((t) => t.id === prefill.type) ? prefill.type! : (data.types[0]?.id ?? ""),
  );
  const [place, setPlace] = useState(
    data.places.some((p) => p.id === prefill.place) ? prefill.place! : (data.places[0]?.id ?? ""),
  );
  const validStart =
    prefill.start && Number.isFinite(new Date(prefill.start).getTime()) ? prefill.start : null;
  const [day, setDay] = useState(validStart ? torontoDate(validStart) : futureDay(1));
  const [time, setTime] = useState(validStart ? torontoTime(validStart) : "15:00");
  const [capacity, setCapacity] = useState(editing?.capacity ?? 6);
  const [minimum, setMinimum] = useState(editing?.min_people ?? 3);
  const [title, setTitle] = useState(editing?.title ?? "");
  // Photo: an uploaded file (storage path + preview URL), or none → the activity type's photo.
  const [photoPath, setPhotoPath] = useState<string | null>(editing?.photo_path ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(editing?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  // Location: a preset public place, or a pin on the map for this activity only.
  const [mode, setMode] = useState<"place" | "map">(editing?.is_custom_location ? "map" : "place");
  const [pin, setPin] = useState<api.ActivityLocation | null>(
    editing?.is_custom_location
      ? { name: editing.place_name, address: editing.address, lat: editing.lat, lng: editing.lng }
      : null,
  );
  const alreadyIn = editing ? editing.capacity - editing.available_spots : 1;
  // Side quests: load the activity's current ones when editing, once.
  const [quests, setQuests] = useState<QuestDraft[]>([]);
  const questsTouched = useRef(false);
  const currentQuests = useQuery({
    queryKey: ["activity-quests", editId],
    queryFn: () => api.getActivityQuests(editId!),
    enabled: !!editId,
  });
  useEffect(() => {
    if (currentQuests.data && !questsTouched.current)
      setQuests(currentQuests.data.map((q) => ({ title: q.title, template_id: q.template_id })));
  }, [currentQuests.data]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosen = data.types.find((t) => t.id === type);
  const chosenPlace = data.places.find((p) => p.id === place);
  const locationReady = mode === "map" ? !!pin && pin.name.trim().length > 0 : !!chosenPlace;
  const ready = !!chosen && locationReady && !uploading;
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!profile) return openAuth();
    setUploading(true);
    setError("");
    try {
      const path = await api.uploadActivityPhoto(file);
      setPhotoPath(path);
      setPhotoPreview(api.activityPhotoUrl(path));
    } catch (e) {
      setError(tr(e instanceof Error ? e.message : "Couldn't upload that photo"));
    } finally {
      setUploading(false);
    }
  };
  const publish = async () => {
    setBusy(true);
    setError("");
    try {
      const input: api.ActivityInput = {
        type_id: type,
        place_id: mode === "place" ? place : null,
        starts_at: localToISO(day, time),
        capacity,
        min_people: minimum,
        title: title.trim() || null,
        photo_path: photoPath,
        location: mode === "map" ? pin : null,
      };
      let id: string;
      if (editId) {
        await api.updateActivity(editId, input);
        id = editId;
        toast.success(tr("Saved! Your activity is updated."));
      } else {
        id = await api.createActivity(input);
        toast.success(tr("Published! Your activity is on the board."));
      }
      // Quests are saved separately; the activity itself is already safe if this fails.
      if (questsTouched.current || (!editId && quests.length)) {
        try {
          await api.setActivityQuests(id, quests);
        } catch (e) {
          toast.error(tr(e instanceof Error ? e.message : "Side quests couldn't be saved"));
        }
      }
      await refreshProfile();
      await navigate({ to: "/activity/$id", params: { id } });
    } catch (e) {
      setError(
        tr(e instanceof Error ? e.message : editId ? "Could not save" : "Could not publish"),
      );
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
        <h1>{tr(editId ? "Edit your activity" : "A little plan starts with you.")}</h1>
        <p>
          {tr(
            editId
              ? "Change the details before it starts. People who joined will see the update."
              : "Review your activity, then put it out into the world.",
          )}
        </p>
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
            {tr("Title (optional)")}
            <input
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr(chosen?.name ?? "Activity")}
            />
          </label>
          <div className="field full">
            {tr("Photo (optional)")}
            <div className="photo-picker">
              <label className="photo-upload">
                <ImagePlus size={16} />
                {tr(uploading ? "Uploading…" : photoPath ? "Change photo" : "Upload a photo")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(e) => {
                    void pickPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {photoPath && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhotoPath(null);
                    setPhotoPreview(null);
                  }}
                >
                  <Trash2 /> {tr("Use the activity's photo")}
                </Button>
              )}
            </div>
          </div>
          <div className="field full">
            {tr("Where")}
            <div className="location-mode" role="radiogroup" aria-label={tr("Where")}>
              <Button
                type="button"
                variant="pill"
                role="radio"
                aria-checked={mode === "place"}
                data-active={mode === "place"}
                onClick={() => setMode("place")}
              >
                {tr("Public place")}
              </Button>
              <Button
                type="button"
                variant="pill"
                role="radio"
                aria-checked={mode === "map"}
                data-active={mode === "map"}
                onClick={() => setMode("map")}
              >
                <MapPin /> {tr("Pick on the map")}
              </Button>
            </div>
          </div>
          {mode === "place" ? (
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
          ) : (
            <div className="full">
              <LocationPicker value={pin} onChange={setPin} />
            </div>
          )}
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
              min={Math.max(2, alreadyIn)}
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
          {chosen && (
            <div className="field full">
              {tr("Side quests (optional)")}
              <QuestEditor
                typeId={chosen.id}
                nicheValue={chosen.niche_value}
                value={quests}
                onChange={(next) => {
                  questsTouched.current = true;
                  setQuests(next);
                }}
              />
            </div>
          )}
          {!chosen && (
            <p className="full text-sm text-destructive" role="alert">
              {tr("No activity types or public places are available yet.")}
            </p>
          )}
          {mode === "map" && !locationReady && (
            <p className="full text-sm text-muted-foreground">
              {tr("Drop a pin on the map and give the spot a name")}
            </p>
          )}
          {error && (
            <p className="full text-sm text-destructive" role="alert">
              {tr(error ?? "")}
            </p>
          )}
          <p className="full text-xs text-muted-foreground">
            {editId
              ? `${tr("1 hour · Already in: ")}${alreadyIn}`
              : tr("1 hour · You’ll be the first person registered.")}
          </p>
          <div className="form-actions full">
            <Button disabled={busy || !ready} type="submit">
              {busy
                ? tr(editId ? "Saving…" : "Publishing…")
                : tr(editId ? "Save changes" : "Publish")}
              <ArrowUpRight />
            </Button>
            <Button variant="outline" asChild>
              {editId ? (
                <Link to="/activity/$id" params={{ id: editId }}>
                  {tr("Cancel")}
                </Link>
              ) : (
                <Link to="/">{tr("Cancel")}</Link>
              )}
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
              src={photoPreview ?? activityImages[visualKind(chosen.name, chosen.keywords)]}
              alt={title.trim() || tr(chosen.name)}
            />
          )}
          <h2>{title.trim() || tr(chosen?.name ?? "")}</h2>
          {title.trim() && chosen && <p className="draft-type">{tr(chosen.name)}</p>}
          <p>
            {mode === "map"
              ? (pin?.name ?? tr("Pick a spot on the map"))
              : tr(chosenPlace?.name ?? "")}
            <br />
            {mode === "map" ? pin?.address : chosenPlace?.address}
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
