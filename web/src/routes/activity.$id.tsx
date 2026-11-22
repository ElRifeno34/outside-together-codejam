import { useLanguage } from "@/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Clock3,
  Users,
  Sparkles,
  ArrowUpRight,
  Check,
  CalendarPlus,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";
import { googleCalendarUrl, downloadIcs } from "@/lib/calendar";
import { locatePrecise } from "@/lib/geo";
import { activityTitle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useApp } from "@/components/app-provider";
import { activityPhoto, formatStart } from "@/components/activity-card";
import * as api from "@/api";
/** Absolute link back to this activity for calendar events (only called from click handlers). */
const pageUrl = (id: string) => `${window.location.origin}/activity/${id}`;
import { toast } from "sonner";
const activityOptions = (id: string) =>
  queryOptions({ queryKey: ["activity", id], queryFn: () => api.getActivity(id) });
export const Route = createFileRoute("/activity/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(activityOptions(params.id)),
  head: ({ loaderData }) => {
    const image = loaderData ? activityPhoto(loaderData) : undefined;
    return {
      meta: [
        {
          title: `${loaderData ? activityTitle(loaderData) : "Activity"} in Montréal · Outside Together`,
        },
        {
          name: "description",
          content: `Join a one-hour ${loaderData ? activityTitle(loaderData) : "activity"} at ${loaderData?.place_name ?? "a public Montréal place"}.`,
        },
        {
          property: "og:title",
          content: `${loaderData ? activityTitle(loaderData) : "Activity"} · Outside Together`,
        },
        {
          property: "og:description",
          content: "Meet a few new people for one hour outside in Montréal.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image?.startsWith("https://")
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  component: ActivityDetail,
});
function ActivityDetail() {
  const { tr, language } = useLanguage();
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();
  const { data: a } = useQuery({ ...activityOptions(id), initialData: initial });
  const { profile, openAuth, refreshProfile } = useApp();
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState("");
  const [resultOwner, setResultOwner] = useState<string | null>(null);
  const my = useQuery({
    queryKey: ["my-activities", profile?.id],
    queryFn: api.getMyActivities,
    enabled: !!profile,
  });
  const membership = my.data?.find((p) => p.activity_id === id);
  const joined = membership && membership.status !== "left";
  const started = Date.now() >= new Date(a.starts_at).getTime();
  const ended = Date.now() >= new Date(a.starts_at).getTime() + 60 * 60000;
  // Participants check themselves in from starts_at (confirm_attendance); 2 check-ins unlock points.
  const confirmOpen = started;
  const checkedIn = membership?.status === "confirmed";
  // Only the creator can edit, and only before it starts (update_activity, migration 009).
  const canEdit =
    !!profile &&
    a.creator_id === profile.id &&
    !started &&
    a.status !== "cancelled" &&
    a.status !== "done";
  // People other than the creator who are registered (shown in the delete confirmation).
  const othersIn = Math.max(0, a.capacity - a.available_spots - 1);
  const remove = async () => {
    setBusy(true);
    try {
      const { others_removed } = await api.deleteActivity(id);
      await client.invalidateQueries();
      toast.success(
        others_removed > 0
          ? `${tr("Activity deleted.")} ${others_removed} ${tr(others_removed === 1 ? "registration was removed." : "registrations were removed.")}`
          : tr("Activity deleted."),
      );
      await navigate({ to: "/" });
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
      setBusy(false);
    }
  };
  const action = async (kind: "join" | "leave" | "confirm") => {
    setBusy(true);
    try {
      if (kind === "confirm") {
        // Proof of presence: the server only accepts a position within 200 m of the place.
        setLocating(true);
        const position = await locatePrecise().finally(() => setLocating(false));
        const outcome = await api.confirmAttendance(id, position);
        const message = outcome.points_unlocked
          ? `We're here! +${outcome.points_earned} points`
          : `You're checked in · waiting for ${outcome.waiting_for} more ${outcome.waiting_for === 1 ? "person" : "people"}`;
        setResult(message);
        setResultOwner(profile?.id ?? null);
        toast.success(tr(message));
      } else {
        await (kind === "join" ? api.joinActivity(id) : api.leaveActivity(id));
        toast.success(tr(kind === "join" ? "You're on the list!" : "You left this activity"));
      }
      await refreshProfile();
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
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
      </div>
      <div className="detail-grid">
        <img className="detail-photo" src={activityPhoto(a)} alt={tr(activityTitle(a))} />
        <section className="detail-content">
          <span className="detail-status">
            {a.status === "done"
              ? tr("Completed")
              : a.status === "confirmed"
                ? tr("It’s happening")
                : a.status === "cancelled"
                  ? tr("Cancelled")
                  : tr("Open to join")}
          </span>
          <h1>{tr(activityTitle(a))}</h1>
          {a.title && <p className="detail-type">{tr(a.activity_name)}</p>}
          <div className="detail-row">
            <MapPin />
            <div>
              {tr(a.place_name ?? "")}
              <small>{a.address}</small>
            </div>
          </div>
          <div className="detail-row">
            <Clock3 />
            <div>
              {formatStart(a.starts_at, language)} {tr("· 1 hour")}
              <small>{tr("Montréal time · America/Toronto")}</small>
            </div>
          </div>
          <div className="detail-row">
            <Users />
            <div>
              {a.joined_count} {" / "}
              {a.capacity} {tr(" joined · ")}
              {a.available_spots} {tr("spots left")}
              <small>
                {tr("Minimum ")}
                {a.min_people} {tr("people to make it happen")}
              </small>
            </div>
          </div>
          <div className="detail-row">
            <Sparkles />
            <div className="text-points">
              {tr("+")}
              {10 + 5 * a.niche_value} {tr("points · niche value ")}
              {a.niche_value}
              {tr("/5")}
              <small>{tr("Points = 10 + 5 × niche value, once 2 participants check in")}</small>
            </div>
          </div>
          <div className="detail-cta">
            {confirmOpen && joined ? (
              <Button disabled={busy || checkedIn} onClick={() => void action("confirm")}>
                {checkedIn ? (
                  <>
                    <Check />
                    {tr("You're checked in")}
                  </>
                ) : locating ? (
                  tr("Checking your location…")
                ) : (
                  tr("We're here")
                )}
              </Button>
            ) : ended ? (
              <p className="detail-note">
                {tr("This activity has ended. Attendance is for registered participants.")}
              </p>
            ) : started ? (
              <Button disabled>{tr("Registration is closed")}</Button>
            ) : joined ? (
              <Button variant="outline" disabled={busy} onClick={() => void action("leave")}>
                {tr("Leave activity")}
              </Button>
            ) : (
              <Button
                disabled={busy || a.available_spots === 0 || a.status === "cancelled"}
                onClick={() => (profile ? void action("join") : openAuth(() => action("join")))}
              >
                {a.available_spots === 0 ? tr("Activity is full") : tr("Join activity")}
                <ArrowUpRight />
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" asChild>
                <Link to="/create" search={{ edit: id }}>
                  <Pencil />
                  {tr("Edit activity")}
                </Link>
              </Button>
            )}
            {canEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="detail-delete" disabled={busy}>
                    <Trash2 />
                    {tr("Delete activity")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>{tr("Delete this activity?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {othersIn > 0
                      ? `${tr("It will disappear for everyone, including the")} ${othersIn} ${tr(othersIn === 1 ? "person who joined." : "people who joined.")} ${tr("This can't be undone.")}`
                      : tr("It will disappear from the board. This can't be undone.")}
                  </AlertDialogDescription>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tr("Keep it")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => void remove()}
                    >
                      {tr("Delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          {checkedIn && a.status !== "done" && (
            <p className="detail-note">
              {tr("Points unlock as soon as one more participant checks in.")}
            </p>
          )}
          {joined && started && !checkedIn && (
            <p className="detail-note">
              {tr(
                "Tap “We're here” once you've met up. Your location confirms you're within 200 m of the place. Points unlock when 2 of you check in.",
              )}
            </p>
          )}
          {result && resultOwner === profile?.id && (
            <div className="attendance-result" role="status">
              {tr(result ?? "")}
            </div>
          )}
          {joined && !started && (
            <p className="detail-note">
              {tr("You’re registered. You can leave any time before it starts.")}
            </p>
          )}
          {!ended && (
            <div className="flex flex-wrap gap-2">
              {/* Built on click so the link back uses the real origin (not known during SSR). */}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(googleCalendarUrl(a, pageUrl(id)), "_blank", "noopener,noreferrer")
                }
              >
                <CalendarPlus />
                {tr("Add to Google Calendar")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => downloadIcs(a, pageUrl(id))}>
                <Download />
                {tr("Download .ics")}
              </Button>
            </div>
          )}
        </section>
      </div>
      <section className="points-band">
        <Users />
        <div>
          <h3>{tr("One hour. No pressure.")}</h3>
          <p>
            {tr("Meet at the public place, spend an hour together, and see where it takes you.")}
          </p>
        </div>
      </section>
    </main>
  );
}
