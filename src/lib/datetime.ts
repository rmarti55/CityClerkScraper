import { DateTime } from "luxon";

/**
 * Santa Fe, NM uses America/Denver. CivicClerk returns event times in local time
 * but may send them with no offset or with Z. We always interpret as America/Denver
 * so the stored UTC instant is correct (and the dashboard shows the right time).
 */
const EVENT_TIMEZONE = "America/Denver";

/**
 * Strip trailing Z or ±HH:MM offset so we can parse the value as local time in America/Denver.
 */
function stripTimezone(isoString: string): string {
  return isoString
    .trim()
    .replace(/Z$/i, "")
    .replace(/[+-]\d{2}:?\d{2}$/, "")
    .trim();
}

/**
 * Parse CivicClerk API startDateTime for storage.
 * Always treats the datetime as America/Denver (Santa Fe) local time: strips any
 * trailing Z or offset, then parses in EVENT_TIMEZONE so 4:00 PM is stored as
 * 23:00 UTC and the UI shows 4:00 PM.
 */
export function parseEventStartDateTime(apiStartDateTime: string): Date {
  const s = apiStartDateTime?.trim() ?? "";
  if (!s) return new Date(NaN);
  const cleaned = stripTimezone(s);
  const dt = DateTime.fromISO(cleaned, { zone: EVENT_TIMEZONE });
  if (!dt.isValid) {
    return new Date(apiStartDateTime);
  }
  return dt.toJSDate();
}

/**
 * Return the event's calendar date in America/Denver as "YYYY-MM-DD".
 * Used for grouping and scroll so section headers match the displayed date on cards.
 * Example: "2026-02-25T01:00:00.000Z" (6 PM Feb 24 Mountain) → "2026-02-24".
 */
export function getEventDateKeyInDenver(isoString: string): string {
  const dt = DateTime.fromISO(isoString.trim(), { zone: EVENT_TIMEZONE });
  if (!dt.isValid) {
    return isoString.split("T")[0] ?? "";
  }
  return dt.toFormat("yyyy-MM-dd");
}

/**
 * Today's date as "YYYY-MM-DD" in America/Denver.
 * Use this instead of new Date().toISOString().split("T")[0] which returns UTC
 * and breaks after ~5 PM Mountain when UTC has already rolled to the next day.
 */
export function getTodayInDenver(): string {
  return DateTime.now().setZone(EVENT_TIMEZONE).toFormat("yyyy-MM-dd");
}

/**
 * Current year and month in America/Denver.
 * Use this instead of new Date().getFullYear() / getMonth() for determining
 * which month to display, since those use the browser/server local timezone.
 */
export function getNowInDenver(): { year: number; month: number; dateKey: string } {
  const dt = DateTime.now().setZone(EVENT_TIMEZONE);
  return { year: dt.year, month: dt.month, dateKey: dt.toFormat("yyyy-MM-dd") };
}

// ---------------------------------------------------------------------------
// Meeting time-status helpers (Today / Happening Now / Upcoming / Past)
// ---------------------------------------------------------------------------

const ASSUMED_MEETING_DURATION_HOURS = 2;

export function isEventToday(startDateTimeIso: string): boolean {
  const eventDateKey = getEventDateKeyInDenver(startDateTimeIso);
  const todayKey = getTodayInDenver();
  return eventDateKey === todayKey;
}

export function isEventHappeningNow(startDateTimeIso: string): boolean {
  const now = DateTime.now().setZone(EVENT_TIMEZONE);
  const start = DateTime.fromISO(startDateTimeIso.trim(), { zone: EVENT_TIMEZONE });
  if (!start.isValid) return false;
  const end = start.plus({ hours: ASSUMED_MEETING_DURATION_HOURS });
  return now >= start && now < end;
}

export type MeetingTimeStatus = "happening-now" | "today" | "upcoming" | "past";

export function getMeetingTimeStatus(startDateTimeIso: string): MeetingTimeStatus {
  if (isEventHappeningNow(startDateTimeIso)) return "happening-now";
  if (isEventToday(startDateTimeIso)) {
    const now = DateTime.now().setZone(EVENT_TIMEZONE);
    const start = DateTime.fromISO(startDateTimeIso.trim(), { zone: EVENT_TIMEZONE });
    if (start.isValid && now < start) return "today";
    return "past";
  }
  const eventDate = new Date(startDateTimeIso);
  return eventDate > new Date() ? "upcoming" : "past";
}
