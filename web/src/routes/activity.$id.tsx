import { useLanguage } from "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CalendarPlus, Check, MapPin } from "lucide-react";
import { googleCalendarUrl, downloadIcs } from "@/lib/calendar";
import { visualKey } from "@/lib/types";
import { torontoDate, torontoTime } from "@/lib/time";
import { dayHeading, startsIn, startsSoon } from "@/lib/timetable";
import { actionState } from "@/lib/activity-action";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/components/app-provider";
import { activityImages } from "@/components/activity-card";
import { levelClass, Pictogram } from "@/components/pictogram";
import { NicheLevel } from "@/components/niche-level";
import * as api from "@/api";
/** Absolute link back to this activity for calendar events (only called from click handlers). */
const pageUrl = (id: string) => `${window.location.origin}/activity/${id}`;
import { toast } from "sonner";
const activityOptions = (id: string) =>
  queryOptions({ queryKey: ["activity", id], queryFn: () => api.getActivity(id) });
export const Route = createFileRoute("/activity/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(activityOptions(params.id)),
  head: ({ loaderData }) => {
    const image = loaderData ? activityImages[visualKey(loaderData)] : undefined;
    return {
      meta: [
        { title: `${loaderData?.activity_name ?? "Activity"} in Montréal · Outside Together` },
        {
          name: "description",
          content: `Join a one-hour ${loaderData?.activity_name.toLowerCase() ?? "activity"} at ${loaderData?.place_name ?? "a public Montréal place"}.`,
        },
        {
          property: "og:title",
          content: `${loaderData?.activity_name ?? "Activity"} · Outside Together`,
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
  const [result, setResult] = useState("");
  const [resultOwner, setResultOwner] = useState<string | null>(null);
  const my = useQuery({
    queryKey: ["my-activities", profile?.id],
    queryFn: api.getMyActivities,
    enabled: !!profile,
  });
  const membership = my.data?.find((p) => p.activity_id === id);
  const joined = !!membership && membership.status !== "left";
  const now = new Date();
  const started = now.getTime() >= new Date(a.starts_at).getTime();
  const ended = now.getTime() >= new Date(a.starts_at).getTime() + 60 * 60000;
  const checkedIn = membership?.status === "confirmed";
  // Participants check themselves in from starts_at (confirm_attendance); 2 check-ins unlock points.
  const state = actionState({
    joined,
    checkedIn,
    started,
    ended,
    availableSpots: a.available_spots,
    status: a.status,
  });
  const points = 10 + 5 * a.niche_value;
  const level = levelClass(a.niche_value);
  const needed = Math.max(0, a.min_people - a.joined_count);

  const action = async (kind: "join" | "leave" | "confirm") => {
    setBusy(true);
    try {
      if (kind === "confirm") {
        const outcome = await api.confirmAttendance(id);
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
  const join = () => (profile ? void action("join") : openAuth(() => action("join")));
  const ownResult = result && resultOwner === profile?.id ? result : "";

  return (
    <main className={`page-width detail ${level}`}>
      <Link to="/" className="detail-back">
        <ArrowLeft aria-hidden="true" />
        {tr("Explore")}
      </Link>

      <div className="detail-layout">
        <img className="detail-hero" src={activityImages[visualKey(a)]} alt="" />

        <section className="detail-body">
          <header className="detail-departure">
            <div className="detail-when">
              <time dateTime={a.starts_at}>{torontoTime(a.starts_at)}</time>
              <span suppressHydrationWarning>
                {dayHeading(torontoDate(a.starts_at), language)}
                {!ended && startsSoon(a.starts_at) && ` · ${startsIn(a.starts_at, language)}`}
              </span>
            </div>
            <div className="detail-title">
              <Pictogram kind={visualKey(a)} level={a.niche_value} size={44} />
              <div>
                <h1>{tr(a.activity_name)}</h1>
                <span className="detail-level">
                  <NicheLevel level={a.niche_value} />
                  <span>
                    +{points} {tr("pts")}
                  </span>
                </span>
              </div>
            </div>
          </header>

          <div className="detail-place">
            <MapPin aria-hidden="true" />
            <div>
              <strong>{tr(a.place_name)}</strong>
              <span>{a.address}</span>
            </div>
          </div>

          <div className="detail-seats">
            <span className="seat-row" aria-hidden="true">
              {Array.from({ length: a.capacity }, (_, i) => (
                <span key={i} data-taken={i < a.joined_count || undefined} />
              ))}
            </span>
            <span>
              <strong>
                {a.joined_count} {tr("of")} {a.capacity} {tr("going")}
              </strong>
              {!started && (
                <>
                  {" · "}
                  {needed > 0 ? `${needed} ${tr("more to make it happen")}` : tr("It’s happening")}
                </>
              )}
            </span>
          </div>

          <div className="detail-action" data-state={state}>
            {state === "join" && (
              <Button size="lg" className="detail-cta level-cta" disabled={busy} onClick={join}>
                {tr("Join")}
              </Button>
            )}
            {state === "full" && (
              <Button size="lg" className="detail-cta" disabled>
                {tr("Activity is full")}
              </Button>
            )}
            {state === "cancelled" && <p className="detail-muted">{tr("Cancelled")}</p>}
            {state === "registered" && (
              <div className="detail-registered">
                <p className="detail-status-line">
                  <Check aria-hidden="true" />
                  {tr("You're in")}
                </p>
                <Button variant="link" disabled={busy} onClick={() => void action("leave")}>
                  {tr("Leave")}
                </Button>
              </div>
            )}
            {state === "closed" && <p className="detail-muted">{tr("Registration is closed")}</p>}
            {state === "departed" && <p className="detail-muted">{tr("This one has departed.")}</p>}
            {state === "check-in" && (
              <>
                <Button
                  size="lg"
                  className="detail-cta level-cta"
                  disabled={busy}
                  onClick={() => void action("confirm")}
                >
                  {tr("We're here")}
                </Button>
                <p className="detail-hint">
                  {tr("Tap once you've met up. Points unlock when 2 of you check in.")}
                </p>
              </>
            )}
            {state === "waiting" && (
              <div className="detail-checkin">
                <span className="checkin-stops" aria-hidden="true">
                  <span data-reached />
                  <span />
                </span>
                <p className="detail-status-line">
                  <Check aria-hidden="true" />
                  {tr("You're checked in")}
                </p>
                <p className="detail-hint">
                  {tr("Points unlock as soon as one more participant checks in.")}
                </p>
              </div>
            )}
            {state === "earned" && (
              <div className="detail-checkin">
                <span className="checkin-stops" aria-hidden="true">
                  <span data-reached />
                  <span data-reached />
                </span>
                <p className="detail-earned">+{points}</p>
                <p className="detail-hint">{tr("Points earned. Good company.")}</p>
              </div>
            )}
            {ownResult && state !== "earned" && (
              <p className="detail-result" role="status">
                {tr(ownResult)}
              </p>
            )}
          </div>

          {joined && !ended && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="detail-calendar">
                  <CalendarPlus />
                  {tr("Add to calendar")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="account-menu">
                {/* Built on click so the link back uses the real origin (not known during SSR). */}
                <DropdownMenuItem
                  onSelect={() =>
                    window.open(googleCalendarUrl(a, pageUrl(id)), "_blank", "noopener,noreferrer")
                  }
                >
                  {tr("Google Calendar")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => downloadIcs(a, pageUrl(id))}>
                  {tr("Apple, Outlook (.ics)")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <details className="detail-how">
            <summary>{tr("How it works")}</summary>
            <ul>
              <li>{tr("One hour at a public place in Montréal.")}</li>
              <li>
                {tr("It happens once")} {a.min_people} {tr("people have joined.")}
              </li>
              <li>{tr("You can leave any time before it starts.")}</li>
              <li>
                {tr(
                  "Once it starts, tap “We're here”. When 2 of you check in, everyone checked in gets",
                )}{" "}
                +{points} {tr("pts")} (10 + 5 × {tr("niche level")} {a.niche_value}).
              </li>
            </ul>
          </details>
        </section>
      </div>
    </main>
  );
}
