"use client";

import { useEvents } from "@/context/EventsContext";
import { MonthPicker } from "./MonthPicker";
import { SearchableContent } from "./SearchableContent";
import { MeetingListSkeleton } from "./skeletons/MeetingCardSkeleton";

function ErrorState({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <svg
          className="w-6 h-6 text-red-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <h3 className="font-medium text-red-800">Failed to Load Meetings</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const {
    isLoading,
    error,
    getEventsForMonth,
    currentYear,
    currentMonth,
    scrollToDate,
  } = useEvents();

  // Get events for the current month from client-side cache
  const events = getEventsForMonth(currentYear, currentMonth);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Santa Fe City Meetings
          </h1>
          <p className="text-gray-500 mt-1">
            Public meeting calendar and documents
          </p>
        </div>

        {/* Month picker */}
        <MonthPicker />

        {/* Meeting list */}
        {isLoading ? (
          <MeetingListSkeleton count={5} />
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          <SearchableContent
            events={events}
            year={currentYear}
            month={currentMonth}
            scrollToDate={scrollToDate ?? undefined}
          />
        )}
      </div>
    </main>
  );
}
