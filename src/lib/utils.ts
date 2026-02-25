import type { CivicEvent } from "@/lib/types";

/**
 * Returns true if the event is considered canceled (from title or attachment names).
 */
export function isEventCanceled(event: CivicEvent): boolean {
  const name = (event.eventName || "").trim();
  if (/^(canceled|cancelled)\b/i.test(name)) return true;
  const files = (event.fileNames || "").toLowerCase();
  if (/\bcancel(l)?(ed|ation)?\b/.test(files)) return true;
  return false;
}

/**
 * Helper to format date for display
 */
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  });
}

/**
 * Helper to format time for display
 */
export function formatEventTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Denver",
  });
}

const VENUE_KEYS = [
  "venueName",
  "venueAddress",
  "venueCity",
  "venueState",
  "venueZip",
] as const;

export type VenuePick = Pick<
  CivicEvent,
  (typeof VENUE_KEYS)[number]
>;

/**
 * Format event venue as a single civic-portal-style address string.
 * e.g. "Councilors' Conference Room, City Hall 200 Lincoln Avenue Santa Fe, New Mexico 87507"
 */
export function formatEventLocation(
  event: VenuePick
): string {
  const { venueName, venueAddress, venueCity, venueState, venueZip } = event;
  const stateZip = [venueState, venueZip].filter(Boolean).join(" ");
  const cityStateZip = venueCity
    ? stateZip
      ? `${venueCity}, ${stateZip}`
      : venueCity
    : stateZip;
  const parts = [venueName, venueAddress, cityStateZip].filter(Boolean);
  return parts.join(" ");
}
