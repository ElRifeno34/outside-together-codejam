// "Add to calendar" without any Google API key or OAuth scope:
// - a Google Calendar template link (the person confirms the event in their own calendar)
// - a standard .ics file for Apple Calendar, Outlook and others.
// Writing events directly with the Google Calendar API is a later step (see PlanOff §3.5).
import type { ActivityBoardRow } from "@/data/fixtures";

type CalendarActivity = Pick<
  ActivityBoardRow,
  "id" | "activity_name" | "place_name" | "address" | "starts_at" | "duration_min"
>;

/** 2026-11-27T20:00:00.000Z → 20261127T200000Z */
function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function range(a: CalendarActivity) {
  const start = new Date(a.starts_at);
  const end = new Date(start.getTime() + a.duration_min * 60000);
  return { start, end };
}

function details(a: CalendarActivity, pageUrl: string) {
  return `One hour outside with Outside Together.\n${pageUrl}`;
}

export function googleCalendarUrl(a: CalendarActivity, pageUrl: string): string {
  const { start, end } = range(a);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${a.activity_name} · Outside Together`,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: details(a, pageUrl),
    location: [a.place_name, a.address].filter(Boolean).join(", "),
    ctz: "America/Toronto",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** RFC 5545 text escaping for SUMMARY / LOCATION / DESCRIPTION values. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function icsContent(a: CalendarActivity, pageUrl: string, now = new Date()): string {
  const { start, end } = range(a);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Outside Together//Montreal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@outside-together`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(`${a.activity_name} · Outside Together`)}`,
    `LOCATION:${escapeText([a.place_name, a.address].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${escapeText(details(a, pageUrl))}`,
    `URL:${pageUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadIcs(a: CalendarActivity, pageUrl: string): void {
  const blob = new Blob([icsContent(a, pageUrl)], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `outside-together-${a.activity_name.toLowerCase().replace(/\W+/g, "-")}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
}
