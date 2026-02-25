"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { DocumentSearchResult, MatchingFile, MatchingItem } from "@/lib/types";
import { formatEventDate, formatEventTime, formatEventLocation } from "@/lib/utils";
import { MapPinIcon } from "./EventLocation";
import { MeetingStatusBadges } from "./MeetingStatusBadges";

/** Render API highlight HTML as React nodes (only <mark> allowed) */
function HighlightedSnippet({ html }: { html: string }) {
  const parts: React.ReactNode[] = [];
  const re = /<mark[^>]*>([^<]*)<\/mark>/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m.index > lastIndex) {
      parts.push(html.slice(lastIndex, m.index));
    }
    parts.push(
      <mark key={m.index} className="bg-yellow-200 text-gray-900 rounded px-0.5">
        {m[1]}
      </mark>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < html.length) parts.push(html.slice(lastIndex));
  return <>{parts.length ? parts : html}</>;
}

interface DocumentSearchResultsProps {
  results: DocumentSearchResult[];
  query: string;
  isLoading: boolean;
  error: string | null;
}

function DocumentResultCard({
  result,
  query,
}: {
  result: DocumentSearchResult;
  query: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { event, matchingFiles, matchingItems, totalInEvent } = result;
  const meetingHref = (() => {
    const params = new URLSearchParams();
    if (query?.trim().length >= 2) params.set("q", query);
    const returnTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    params.set("from", returnTo);
    return `/meeting/${event.id}?${params.toString()}`;
  })();
  const locationStr = formatEventLocation(event);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Link
        href={meetingHref}
        className="block p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">{event.eventName}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {formatEventDate(event.startDateTime)} at{" "}
              {formatEventTime(event.startDateTime)}
            </p>
            {locationStr && (
              <p className="text-sm text-gray-500 flex items-start gap-1.5 mt-1 min-w-0 truncate" aria-label="Location">
                <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <span className="truncate" title={locationStr}>{locationStr}</span>
              </p>
            )}
          </div>
          <MeetingStatusBadges
            event={event}
            fileCount={event.fileCount ?? 0}
            variant="card"
            className="sm:flex-col sm:items-end"
          />
        </div>
      </Link>
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/80">
        <p className="text-sm font-medium text-gray-700 mb-2">
          {totalInEvent} result{totalInEvent !== 1 ? "s" : ""} in this event
        </p>
        <ul className="space-y-2 text-sm">
          {matchingFiles.map((f) => (
            <MatchingFileRow key={`f-${f.fileId}-${f.name}`} file={f} eventId={event.id} />
          ))}
          {matchingItems.map((it) => (
            <li key={`i-${it.id}`} className="flex items-start gap-2 text-gray-600">
              <span className="text-gray-400 shrink-0">•</span>
              {it.highlightedName ? (
                <HighlightedSnippet html={it.highlightedName} />
              ) : (
                <span>{it.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MatchingFileRow({ file, eventId }: { file: MatchingFile; eventId: number }) {
  const viewUrl = `/api/file/${file.fileId}`;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
        >
          <span className="shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          {file.highlightedName ? (
            <HighlightedSnippet html={file.highlightedName} />
          ) : (
            <span>{file.name}</span>
          )}
        </a>
        {file.type && (
          <span className="text-xs text-gray-400">({file.type})</span>
        )}
      </div>
      {file.snippets && file.snippets.length > 0 && (
        <ul className="ml-6 mt-0.5 space-y-0.5 text-gray-600">
          {file.snippets.slice(0, 3).map((s, i) => (
            <li key={i} className="text-xs">
              <HighlightedSnippet html={s} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-48" />
        </div>
      ))}
    </div>
  );
}

export function DocumentSearchResults({
  results,
  query,
  isLoading,
  error,
}: DocumentSearchResultsProps) {
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
          <span>Searching in documents for {filterDescription}...</span>
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-gray-500">No document matches for {filterDescription}</p>
        <p className="text-sm text-gray-400 mt-1">Try different keywords</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          <span>
            {results.length} event{results.length !== 1 ? "s" : ""} with document matches for {filterDescription}
          </span>
          {isLoading && <span className="ml-2 text-gray-400">(updating...)</span>}
        </div>
      </div>
      <div className="space-y-3">
        {results.map((result) => (
          <DocumentResultCard key={result.event.id} result={result} query={query} />
        ))}
      </div>
    </div>
  );
}
