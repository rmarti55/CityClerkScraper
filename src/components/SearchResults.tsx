"use client";

import Link from "next/link";
import { SearchResult, getHighlightedSegments } from "@/hooks/useSearch";
import { formatEventDate, formatEventTime, formatEventLocation } from "@/lib/utils";
import { MapPinIcon } from "./EventLocation";
import { MeetingStatusBadges } from "./MeetingStatusBadges";

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
}

function HighlightedText({
  text,
  matches,
  fieldName,
}: {
  text: string;
  matches: readonly SearchResult["matches"][number][];
  fieldName: string;
}) {
  if (!text) return null;

  const segments = getHighlightedSegments(text, matches, fieldName);

  return (
    <>
      {segments.map((segment, i) =>
        segment.highlighted ? (
          <mark
            key={i}
            className="bg-yellow-200 text-gray-900 rounded px-0.5"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!text || !query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-200 text-gray-900 rounded px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

function SearchResultCard({ result, query }: { result: SearchResult; query: string }) {
  const { item: event, matches } = result;
  const locationStr = formatEventLocation(event);
  const venueMatched = matches.some((m) =>
    ["venueName", "venueAddress", "venueCity", "venueState", "venueZip"].includes(String(m.key))
  );

  return (
    <Link
      href={`/meeting/${event.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-gray-900">
            <HighlightedText
              text={event.eventName}
              matches={matches}
              fieldName="eventName"
            />
          </h3>

          {/* Date and time */}
          <p className="text-sm text-gray-500 mt-1">
            {formatEventDate(event.startDateTime)} at{" "}
            {formatEventTime(event.startDateTime)}
          </p>

          {/* Location with highlighting */}
          {locationStr && (
            <p className="text-sm text-gray-500 flex items-start gap-1.5 mt-1 min-w-0 truncate" aria-label="Location">
              <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <span className="truncate" title={locationStr}>
                {venueMatched && query ? highlightMatch(locationStr, query) : locationStr}
              </span>
            </p>
          )}

          {/* Description snippet if matched */}
          {event.eventDescription &&
            matches.some((m) => m.key === "eventDescription") && (
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                <HighlightedText
                  text={event.eventDescription}
                  matches={matches}
                  fieldName="eventDescription"
                />
              </p>
            )}
        </div>

        {/* Status badges */}
        <MeetingStatusBadges
          event={event}
          fileCount={event.fileCount ?? 0}
          variant="card"
          className="flex-col items-end flex-shrink-0"
        />
      </div>
    </Link>
  );
}

export function SearchResults({ results, query }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 text-gray-300 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <p className="text-gray-500">
          No meetings found for &quot;{query}&quot;
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Try different keywords or check spelling
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Results count */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
        <span>
          {results.length} result{results.length !== 1 ? "s" : ""} for &quot;{query}&quot;
        </span>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {results.map((result) => (
          <SearchResultCard key={result.item.id} result={result} query={query} />
        ))}
      </div>
    </div>
  );
}
