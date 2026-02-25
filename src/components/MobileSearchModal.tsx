"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CivicEvent } from "@/lib/types";
import { formatEventDate, formatEventTime, formatEventLocation, isEventCanceled } from "@/lib/utils";
import { MapPinIcon } from "./EventLocation";

interface MobileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  recentSearches: string[];
  onSelectRecentSearch: (term: string) => void;
  onRemoveRecentSearch: (term: string) => void;
  searchResults: CivicEvent[];
  searchTotal: number;
  isSearching: boolean;
  searchError: string | null;
  debouncedQuery: string;
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

function SearchResultItem({
  event,
  query,
  onClose,
}: {
  event: CivicEvent;
  query: string;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasFiles = (event.fileCount ?? 0) > 0;
  const eventDate = new Date(event.startDateTime);
  const now = new Date();
  const isFuture = eventDate >= now;
  const isCanceled = isEventCanceled(event);

  const returnTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
  const meetingHref = `/meeting/${event.id}?q=${encodeURIComponent(query)}&from=${encodeURIComponent(returnTo)}`;
  const locationStr = formatEventLocation(event);

  return (
    <Link
      href={meetingHref}
      onClick={onClose}
      className="block px-4 py-4 border-b border-gray-100 active:bg-gray-50 transition-colors touch-manipulation"
      style={{ minHeight: "72px" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-medium text-gray-900 line-clamp-2">
            {highlightMatch(event.eventName, query)}
          </h3>

          {/* Date and time */}
          <p className="text-sm text-gray-500 mt-1">
            {formatEventDate(event.startDateTime)} at{" "}
            {formatEventTime(event.startDateTime)}
          </p>

          {/* Location */}
          {locationStr && (
            <p className="text-sm text-gray-500 flex items-start gap-1.5 mt-0.5 min-w-0 truncate" aria-label="Location">
              <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <span className="truncate" title={locationStr}>
                {query && locationStr.toLowerCase().includes(query.toLowerCase())
                  ? highlightMatch(locationStr, query)
                  : locationStr}
              </span>
            </p>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isCanceled && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
              Canceled
            </span>
          )}
          {isFuture && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
              Upcoming
            </span>
          )}
          {hasFiles && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
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
              {event.fileCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function MobileSearchModal({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  recentSearches,
  onSelectRecentSearch,
  onRemoveRecentSearch,
  searchResults,
  searchTotal,
  isSearching,
  searchError,
  debouncedQuery,
}: MobileSearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure modal animation has started
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    onSearchChange("");
    onClose();
  };

  const handleClear = () => {
    onSearchChange("");
    inputRef.current?.focus();
  };

  const handleSelectRecentSearch = (term: string) => {
    onSearchChange(term);
    onSelectRecentSearch(term);
  };

  const handleRemoveRecentSearch = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    e.preventDefault();
    onRemoveRecentSearch(term);
  };

  // Determine what to show
  const showRecentSearches = recentSearches.length > 0 && debouncedQuery.trim().length < 2;
  const showResults = debouncedQuery.trim().length >= 2;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white animate-in fade-in duration-200 flex flex-col">
      {/* Header with search input */}
      <div 
        className="flex-shrink-0 bg-white border-b border-gray-200"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Search input container */}
          <div className="relative flex-1">
            {/* Search icon or loading spinner */}
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isSearching ? (
                <svg
                  className="w-5 h-5 text-gray-400 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )}
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search meetings, agendas, minutes..."
              className="block w-full pl-10 pr-10 py-3 text-base text-gray-900 placeholder-gray-400 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />

            {/* Clear button */}
            {searchQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors touch-manipulation"
                aria-label="Clear search"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Cancel button */}
          <button
            type="button"
            onClick={handleClose}
            className="text-indigo-600 text-base font-medium whitespace-nowrap touch-manipulation py-2"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto overscroll-contain bg-gray-50">
        {/* Recent searches */}
        {showRecentSearches && (
          <div className="bg-white">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Recent Searches
              </h2>
            </div>
            <ul>
              {recentSearches.map((term) => (
                <li key={term}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectRecentSearch(term)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectRecentSearch(term);
                      }
                    }}
                    className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 active:bg-gray-50 transition-colors touch-manipulation cursor-pointer"
                    style={{ minHeight: "56px" }}
                  >
                    {/* Clock icon */}
                    <svg
                      className="w-5 h-5 text-gray-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>

                    {/* Search term */}
                    <span className="flex-1 text-gray-900 truncate">
                      {term}
                    </span>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveRecentSearch(e, term)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors touch-manipulation"
                      aria-label={`Remove "${term}" from recent searches`}
                      style={{ minWidth: "40px", minHeight: "40px" }}
                    >
                      <svg
                        className="w-5 h-5 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Empty state when no recent searches and no query */}
        {!showRecentSearches && !showResults && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <svg
              className="w-16 h-16 text-gray-300 mb-4"
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
            <p className="text-gray-500 text-lg">Search for meetings</p>
            <p className="text-gray-400 text-sm mt-1">
              Find agendas, minutes, and more
            </p>
          </div>
        )}

        {/* Search results */}
        {showResults && (
          <div className="bg-white">
            {/* Error state */}
            {searchError && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <svg
                  className="w-12 h-12 text-red-300 mb-4"
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
                <p className="text-gray-500">{searchError}</p>
                <p className="text-sm text-gray-400 mt-1">Please try again</p>
              </div>
            )}

            {/* Loading state */}
            {isSearching && searchResults.length === 0 && !searchError && (
              <div>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm text-gray-500">
                    Searching for &quot;{debouncedQuery}&quot;...
                  </p>
                </div>
                <LoadingSkeleton />
              </div>
            )}

            {/* No results */}
            {!isSearching && searchResults.length === 0 && !searchError && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <svg
                  className="w-12 h-12 text-gray-300 mb-4"
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
                  No meetings found for &quot;{debouncedQuery}&quot;
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Try different keywords or check spelling
                </p>
              </div>
            )}

            {/* Results list */}
            {searchResults.length > 0 && (
              <>
                <div className="px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
                  <p className="text-sm text-gray-500">
                    {searchTotal} result{searchTotal !== 1 ? "s" : ""} for &quot;{debouncedQuery}&quot;
                    {isSearching && (
                      <span className="ml-2 text-gray-400">(updating...)</span>
                    )}
                  </p>
                </div>
                <div>
                  {searchResults.map((event) => (
                    <SearchResultItem
                      key={event.id}
                      event={event}
                      query={debouncedQuery}
                      onClose={onClose}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Safe area padding for iOS */}
      <div
        className="flex-shrink-0 bg-gray-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      />
    </div>
  );
}
