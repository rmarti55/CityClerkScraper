"use client";

import { highlightMatch } from "@/lib/highlight";
import { formatEventLocation, buildMapsUrl } from "@/lib/utils";
import { MapPinIcon } from "@/components/EventLocation";
import type { CivicEvent } from "@/lib/types";

interface SearchResultLocationProps {
  event: CivicEvent;
  query?: string;
  iconClassName?: string;
  className?: string;
}

/**
 * Renders the location line for a search result card, including:
 * - MapPinIcon
 * - Optionally highlighted location text
 * - Clickable link to Google Maps when an address is available
 */
export function SearchResultLocation({
  event,
  query,
  iconClassName = "w-4 h-4 text-indigo-400 shrink-0 mt-0.5",
  className = "text-sm text-gray-600 flex items-start gap-1.5 mt-2 min-w-0 truncate",
}: SearchResultLocationProps) {
  const locationStr = formatEventLocation(event);
  if (!locationStr) return null;

  const mapsUrl = buildMapsUrl(event);
  const venueMatches = query && locationStr.toLowerCase().includes(query.toLowerCase());
  const locationContent = venueMatches ? highlightMatch(locationStr, query) : locationStr;

  return (
    <p className={className} aria-label="Location">
      <MapPinIcon className={iconClassName} />
      {mapsUrl ? (
        <span
          role="link"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(mapsUrl, "_blank", "noopener,noreferrer");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              window.open(mapsUrl, "_blank", "noopener,noreferrer");
            }
          }}
          className="truncate hover:underline cursor-pointer"
          title={locationStr}
        >
          {locationContent}
        </span>
      ) : (
        <span className="truncate" title={locationStr}>
          {locationContent}
        </span>
      )}
    </p>
  );
}
