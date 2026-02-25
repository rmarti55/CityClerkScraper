"use client";

import type { CivicEvent } from "@/lib/types";
import { formatEventLocation } from "@/lib/utils";

/** Map pin icon (Heroicons outline style). Exported for use in search results with highlighting. */
export function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

interface EventLocationProps {
  event: Pick<
    CivicEvent,
    "venueName" | "venueAddress" | "venueCity" | "venueState" | "venueZip"
  >;
  /** Optional class for the wrapper */
  className?: string;
  /** Optional class for the icon */
  iconClassName?: string;
  /** If set, full address is truncated with this title on hover */
  truncate?: boolean;
  /** Render as inline (default) or block */
  block?: boolean;
}

export function EventLocation({
  event,
  className = "",
  iconClassName = "w-4 h-4 text-gray-400 shrink-0 mt-0.5",
  truncate = false,
  block = false,
}: EventLocationProps) {
  const location = formatEventLocation(event);
  if (!location) return null;

  const content = (
    <>
      <MapPinIcon className={iconClassName} />
      <span
        className={`min-w-0 ${block ? "block" : ""} ${truncate ? "truncate" : ""}`.trim()}
        title={truncate ? location : undefined}
      >
        {location}
      </span>
    </>
  );

  return (
    <p
      className={`text-sm text-gray-500 flex items-start gap-1.5 min-w-0 ${truncate ? "truncate" : ""} ${className}`.trim()}
      aria-label="Location"
    >
      {content}
    </p>
  );
}
