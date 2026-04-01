"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { CivicEvent } from "@/lib/types";
import { formatEventLocation, buildMapsUrl } from "@/lib/utils";
import { useMediaStatus } from "@/hooks/useMediaStatus";
import { MapPinIcon } from "./EventLocation";
import { MeetingCard } from "./MeetingCard";
import type { MediaFlags } from "./MeetingStatusBadges";

interface GlobalSearchResultsProps {
  results: CivicEvent[];
  query: string;
  total: number;
  isLoading: boolean;
  error: string | null;
  categoryName?: string | null;
  categoryId?: number | null;
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

function getMatchedFields(event: CivicEvent, query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const matches: string[] = [];

  if (event.eventName?.toLowerCase().includes(lowerQuery)) matches.push("title");
  if (event.categoryName?.toLowerCase().includes(lowerQuery)) matches.push("category");
  if (event.agendaName?.toLowerCase().includes(lowerQuery)) matches.push("agenda");
  if (event.eventDescription?.toLowerCase().includes(lowerQuery)) matches.push("description");
  const locationStr = formatEventLocation(event);
  if (locationStr && locationStr.toLowerCase().includes(lowerQuery)) matches.push("venue");

  return matches;
}

function GlobalSearchResultCard({
  event,
  query,
  categoryId,
  media,
}: {
  event: CivicEvent;
  query: string;
  categoryId?: number | null;
  media?: MediaFlags;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildMeetingHref = () => {
    const params = new URLSearchParams();
    if (query && query.trim().length >= 2) params.set("q", query);
    if (categoryId) params.set("category", String(categoryId));
    const returnTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    params.set("from", returnTo);
    return `/meeting/${event.id}?${params.toString()}`;
  };

  const locationStr = formatEventLocation(event);
  const mapsUrl = buildMapsUrl(event);
  const matchedFields = getMatchedFields(event, query);
  const titleMatches = event.eventName?.toLowerCase().includes(query.toLowerCase());
  const venueMatches = locationStr?.toLowerCase().includes(query.toLowerCase());
  const descriptionMatches = event.eventDescription?.toLowerCase().includes(query.toLowerCase());
  const showMatchIndicator = !titleMatches && !venueMatches && !descriptionMatches && matchedFields.length > 0;

  const locationTextContent = query && venueMatches ? highlightMatch(locationStr, query) : locationStr;

  const locationNode = locationStr ? (
    <p className="text-sm text-gray-600 flex items-start gap-1.5 mt-2 min-w-0 truncate" aria-label="Location">
      <MapPinIcon className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
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
          {locationTextContent}
        </span>
      ) : (
        <span className="truncate" title={locationStr}>
          {locationTextContent}
        </span>
      )}
    </p>
  ) : null;

  return (
    <MeetingCard
      event={event}
      href={buildMeetingHref()}
      titleNode={highlightMatch(event.eventName, query)}
      locationNode={locationNode}
      media={media}
    >
      {event.matchingAgendaItem && (
        <p className="text-sm text-indigo-700 mt-2 flex items-start gap-1.5">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="line-clamp-2">
            Agenda item: {highlightMatch(event.matchingAgendaItem, query)}
          </span>
        </p>
      )}
      {event.eventDescription && descriptionMatches && !event.matchingAgendaItem && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
          {highlightMatch(event.eventDescription, query)}
        </p>
      )}
      {showMatchIndicator && !event.matchingAgendaItem && (
        <p className="text-xs text-gray-500 mt-2 italic">
          Matched in: {matchedFields.join(", ")}
        </p>
      )}
    </MeetingCard>
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
  isLoading,
  error,
  categoryName,
  categoryId,
}: GlobalSearchResultsProps) {
  const mediaStatus = useMediaStatus(results.map((e) => e.id));
  const hasQuery = query && query.trim().length >= 2;
  const hasCategory = categoryName && categoryName.trim().length > 0;

  const getFilterDescription = () => {
    if (hasQuery && hasCategory) return `"${query}" in ${categoryName}`;
    if (hasQuery) return `"${query}"`;
    if (hasCategory) return categoryName;
    return "";
  };

  const filterDescription = getFilterDescription();

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
        <p className="text-gray-600">{error}</p>
        <p className="text-sm text-gray-500 mt-1">Please try again</p>
      </div>
    );
  }

  if (isLoading && results.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
          <span>Searching for {filterDescription}...</span>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (results.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 text-gray-900 mx-auto mb-4"
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
        <p className="text-gray-600">
          No meetings found for {filterDescription}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Try different keywords or check spelling
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          <span>
            Showing {total} result{total !== 1 ? "s" : ""} for {filterDescription}
          </span>
          {isLoading && (
            <span className="ml-2 text-gray-500">(updating...)</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {results.map((event) => (
          <GlobalSearchResultCard key={event.id} event={event} query={query} categoryId={categoryId} media={mediaStatus?.[String(event.id)]} />
        ))}
      </div>
    </div>
  );
}
