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
  });
}
