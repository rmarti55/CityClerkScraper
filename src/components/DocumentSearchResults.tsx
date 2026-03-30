"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { DocumentSearchResult, MatchingFile } from "@/lib/types";
import { formatEventDate, formatEventTime, formatEventLocation, buildMapsUrl } from "@/lib/utils";
import { MapPinIcon } from "./EventLocation";
import { MeetingStatusBadges } from "./MeetingStatusBadges";

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
  const [docsExpanded, setDocsExpanded] = useState(false);
  const { event, matchingFiles, matchingItems, totalInEvent, eventFiles } = result;

  const meetingHref = (() => {
    const params = new URLSearchParams();
    if (query?.trim().length >= 2) params.set("q", query);
    const returnTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    params.set("from", returnTo);
    return `/meeting/${event.id}?${params.toString()}`;
  })();

  const locationStr = formatEventLocation(event);
  const mapsUrl = buildMapsUrl(event);

  const matchingFileIds = new Set(matchingFiles.map((f) => f.fileId));
  const allEventFiles = eventFiles ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Link
        href={meetingHref}
        className="block p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">{event.eventName}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {formatEventDate(event.startDateTime)} at{" "}
              {formatEventTime(event.startDateTime)}
            </p>
            {locationStr && (
              <p className="text-sm text-gray-600 flex items-start gap-1.5 mt-1 min-w-0 truncate" aria-label="Location">
                <MapPinIcon className="w-4 h-4 text-gray-700 shrink-0 mt-0.5" />
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
                    {locationStr}
                  </span>
                ) : (
                  <span className="truncate" title={locationStr}>{locationStr}</span>
                )}
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
        <p className="text-sm font-medium text-gray-800 mb-2">
          {totalInEvent} result{totalInEvent !== 1 ? "s" : ""} in this event
        </p>
        <ul className="space-y-2 text-sm">
          {matchingFiles.map((f) => (
            <FileRow key={`f-${f.fileId}`} file={f} />
          ))}
          {matchingItems.map((it) => (
            <li key={`i-${it.id}`} className="flex items-start gap-2 text-gray-800">
              <svg className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <Link href={meetingHref} className="hover:underline text-gray-900">
                {it.highlightedName ? (
                  <HighlightedSnippet html={it.highlightedName} />
                ) : (
                  <span>{it.name}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {allEventFiles.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2 bg-gray-50/50">
          <button
            type="button"
            onClick={() => setDocsExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 py-1 w-full text-left"
          >
            <svg
              className={`w-4 h-4 transition-transform ${docsExpanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {docsExpanded ? "Hide" : "View"} {allEventFiles.length} Document{allEventFiles.length !== 1 ? "s" : ""}
          </button>
          {docsExpanded && (
            <ul className="space-y-1.5 pb-2 pt-1">
              {allEventFiles.map((f) => (
                <EventFileRow
                  key={f.fileId}
                  file={f}
                  isMatch={matchingFileIds.has(f.fileId)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({ file }: { file: MatchingFile }) {
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
          <span className="text-xs text-gray-500">({file.type})</span>
        )}
      </div>
      {file.snippets && file.snippets.length > 0 && (
        <ul className="ml-6 mt-0.5 space-y-0.5 text-gray-800">
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

function EventFileRow({
  file,
  isMatch,
}: {
  file: MatchingFile;
  isMatch: boolean;
}) {
  const viewUrl = `/api/file/${file.fileId}`;
  const downloadUrl = `/api/file/${file.fileId}?download=true&name=${encodeURIComponent(file.name)}`;

  return (
    <li className={`flex items-center gap-2 py-1.5 px-2 rounded text-sm ${isMatch ? "bg-yellow-50" : ""}`}>
      <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path d="M8 12h8v2H8zM8 15h8v2H8z" />
      </svg>
      <div className="flex-1 min-w-0">
        <span className="text-gray-900 truncate block">{file.name}</span>
        {file.type && (
          <span className="text-xs text-gray-500">({file.type})</span>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View PDF"
          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </a>
        <a
          href={downloadUrl}
          title="Download"
          className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
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
        <p className="text-gray-600">{error}</p>
        <p className="text-sm text-gray-500 mt-1">Please try again</p>
      </div>
    );
  }

  if (isLoading && results.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
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
          className="w-12 h-12 text-gray-900 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-gray-600">No document matches for {filterDescription}</p>
        <p className="text-sm text-gray-500 mt-1">Try different keywords</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          <span>
            {results.length} event{results.length !== 1 ? "s" : ""} with document matches for {filterDescription}
          </span>
          {isLoading && <span className="ml-2 text-gray-500">(updating...)</span>}
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
