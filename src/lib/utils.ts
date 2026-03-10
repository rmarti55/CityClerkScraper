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

/**
 * Returns a human-readable relative time string (e.g. "2h ago", "just now").
 * Designed for showing when meeting data was last synced from the API.
 */
export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

/**
 * Format event venue for short display (e.g. mobile cards).
 * Prioritizes venueName, falls back to venueAddress.
 */
export function formatShortEventLocation(
  event: VenuePick
): string {
  if (event.venueName) return event.venueName;
  if (event.venueAddress) return event.venueAddress;
  return formatEventLocation(event);
}

/**
 * Build a Google Maps URL from venue address fields.
 * Uses address/city/state/zip only (not venueName, which is typically a room name).
 * Returns null when there is no usable address data.
 */
export function buildMapsUrl(event: VenuePick): string | null {
  const { venueAddress, venueCity, venueState, venueZip } = event;
  const addressParts = [venueAddress, venueCity, venueState, venueZip].filter(Boolean);
  if (addressParts.length === 0) return null;
  const query = addressParts.join(", ");
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}`;
}
