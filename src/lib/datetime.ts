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
