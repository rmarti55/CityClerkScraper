"use client";

import Link from "next/link";
import { SearchResult, getHighlightedSegments } from "@/hooks/useSearch";
import { formatEventDate, formatEventTime } from "@/lib/utils";

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

function SearchResultCard({ result }: { result: SearchResult }) {
  const { item: event, matches } = result;
  const hasFiles = event.fileCount && event.fileCount > 0;

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
          {event.venueName && (
            <p className="text-sm text-gray-400 mt-1 truncate">
              <HighlightedText
                text={event.venueName}
                matches={matches}
                fieldName="venueName"
              />
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
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* File count badge - always show with icon */}
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
            hasFiles 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-gray-100 text-gray-500'
          }`}>
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            {event.fileCount || 0}
          </span>

          {event.agendaId && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
              Has Agenda
            </span>
          )}
        </div>
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
          <SearchResultCard key={result.item.id} result={result} />
        ))}
      </div>
    </div>
  );
}
