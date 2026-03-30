"use client";

import Link from "next/link";
import type { TranscriptSearchHit } from "@/hooks/useTranscriptSearch";
import { formatEventDate } from "@/lib/utils";

function highlightSnippet(text: string, query: string): React.ReactNode {
  if (!text || !query) return text;

  const words = query
    .replace(/"([^"]+)"/g, "$1")
    .replace(/(?:^|\s)-\w+/g, "")
    .replace(/\bOR\b/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (words.length === 0) return text;

  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function TranscriptHitCard({
  hit,
  query,
}: {
  hit: TranscriptSearchHit;
  query: string;
}) {
  const meetingHref = `/meeting/${hit.eventId}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Link
        href={meetingHref}
        className="block p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{hit.eventName}</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            <span className="text-sm text-gray-600">
              {formatEventDate(hit.eventDate)}
            </span>
            {hit.categoryName && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800">
                {hit.categoryName}
              </span>
            )}
            {hit.videoTitle && (
              <span className="text-xs text-gray-500 truncate max-w-[200px]">
                {hit.videoTitle}
              </span>
            )}
          </div>
        </div>
      </Link>
      {hit.snippet && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/80">
          <p className="text-sm text-gray-800 line-clamp-3">
            {highlightSnippet(hit.snippet, query)}
          </p>
        </div>
      )}
    </div>
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

interface TranscriptSearchResultsProps {
  results: TranscriptSearchHit[];
  query: string;
  isLoading: boolean;
  error: string | null;
}

export function TranscriptSearchResults({
  results,
  query,
  isLoading,
  error,
}: TranscriptSearchResultsProps) {
  const filterDescription = query?.trim() ? `"${query.trim()}"` : "";

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
          <span>Searching transcripts for {filterDescription}...</span>
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
          No transcript matches for {filterDescription}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Try different keywords or check if transcripts are available
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          <span>
            {results.length} transcript{results.length !== 1 ? "s" : ""} matching{" "}
            {filterDescription}
          </span>
          {isLoading && (
            <span className="ml-2 text-gray-500">(updating...)</span>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {results.map((hit) => (
          <TranscriptHitCard
            key={hit.transcriptId}
            hit={hit}
            query={query}
          />
        ))}
      </div>
    </div>
  );
}
