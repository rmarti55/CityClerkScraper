"use client";

import Link from "next/link";
import { CivicEvent } from "@/lib/types";
import { formatEventDate, formatEventTime } from "@/lib/utils";
import { EventLocation } from "./EventLocation";
import { Pagination } from "./Pagination";
import { Category } from "@/hooks/useCategories";
import { MeetingStatusBadges } from "./MeetingStatusBadges";

interface CategoryFilterResultsProps {
  results: CivicEvent[];
  category: Category;
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onClearFilter: () => void;
}

function ResultCard({ event }: { event: CivicEvent }) {
  return (
    <Link
      href={`/meeting/${event.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-gray-900">{event.eventName}</h3>

          {/* Date and time */}
          <p className="text-sm text-gray-500 mt-1">
            {formatEventDate(event.startDateTime)} at{" "}
            {formatEventTime(event.startDateTime)}
          </p>

          {/* Location */}
          <EventLocation event={event} truncate className="mt-1" />
        </div>

        {/* Status badges */}
        <MeetingStatusBadges
          event={event}
          fileCount={event.fileCount ?? 0}
          variant="card"
          className="sm:flex-col sm:items-end"
        />
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

export function CategoryFilterResults({
  results,
  category,
  total,
  page,
  totalPages,
  isLoading,
  error,
  onPageChange,
  onClearFilter,
}: CategoryFilterResultsProps) {
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
          <span>Loading {category.name} meetings...</span>
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
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p className="text-gray-500">No meetings found for {category.name}</p>
        <button
          onClick={onClearFilter}
          className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
        >
          Clear filter
        </button>
      </div>
    );
  }

  const startResult = (page - 1) * 20 + 1;
  const endResult = Math.min(page * 20, total);

  return (
    <div>
      {/* Header with result count */}
      <div className="flex items-center justify-end mb-4">
        <div className="text-sm text-gray-500">
          <span>
            Showing {startResult}-{endResult} of {total} meeting
            {total !== 1 ? "s" : ""}
          </span>
          {isLoading && (
            <span className="ml-2 text-gray-400">(updating...)</span>
          )}
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-3 mb-6">
        {results.map((event) => (
          <ResultCard key={event.id} event={event} />
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
