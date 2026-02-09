"use client";

import Link from "next/link";
import { CivicEvent } from "@/lib/types";
import { formatEventDate, formatEventTime } from "@/lib/utils";
import { Pagination } from "./Pagination";

interface GlobalSearchResultsProps {
  results: CivicEvent[];
  query: string;
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
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

function SearchResultCard({
  event,
  query,
}: {
  event: CivicEvent;
  query: string;
}) {
  const hasFiles = event.fileCount && event.fileCount > 0;
  const eventDate = new Date(event.startDateTime);
  const now = new Date();
  const isFuture = eventDate >= now;

  // Include search query in link so back navigation preserves search state
  const meetingHref = `/meeting/${event.id}?q=${encodeURIComponent(query)}`;

  return (
    <Link
      href={meetingHref}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-gray-900">
            {highlightMatch(event.eventName, query)}
          </h3>

          {/* Date and time */}
          <p className="text-sm text-gray-500 mt-1">
            {formatEventDate(event.startDateTime)} at{" "}
            {formatEventTime(event.startDateTime)}
          </p>

          {/* Location */}
          {event.venueName && (
            <p className="text-sm text-gray-400 mt-1 truncate">
              {highlightMatch(event.venueName, query)}
            </p>
          )}

          {/* Description snippet if it contains the search term */}
          {event.eventDescription &&
            event.eventDescription.toLowerCase().includes(query.toLowerCase()) && (
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                {highlightMatch(event.eventDescription, query)}
              </p>
            )}
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {/* File count badge - always show with icon */}
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
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

          {/* Upcoming indicator for future meetings - matches MeetingCard style */}
          {isFuture && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded whitespace-nowrap">
              Upcoming
            </span>
          )}

          {event.agendaId && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded whitespace-nowrap">
              Has Agenda
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
        >
          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-48" />
        </div>
      ))}
    </div>
  );
}

export function GlobalSearchResults({
  results,
  query,
  total,
  page,
  totalPages,
  isLoading,
  error,
  onPageChange,
}: GlobalSearchResultsProps) {
  if (error) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 text-red-300 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-gray-500">{error}</p>
        <p className="text-sm text-gray-400 mt-1">Please try again</p>
      </div>
    );
  }

  if (isLoading && results.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <span>Searching for &quot;{query}&quot;...</span>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (results.length === 0 && !isLoading) {
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

  const startResult = (page - 1) * 20 + 1;
  const endResult = Math.min(page * 20, total);

  return (
    <div>
      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          <span>
            Showing {startResult}-{endResult} of {total} result
            {total !== 1 ? "s" : ""} for &quot;{query}&quot;
          </span>
          {isLoading && (
            <span className="ml-2 text-gray-400">(updating...)</span>
          )}
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-3 mb-6">
        {results.map((event) => (
          <SearchResultCard key={event.id} event={event} query={query} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
