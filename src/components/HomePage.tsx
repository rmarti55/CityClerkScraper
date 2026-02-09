"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useEvents } from "@/context/EventsContext";
import { MonthPicker } from "./MonthPicker";
import { SearchableContent } from "./SearchableContent";
import { StickyHeader } from "./StickyHeader";
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
  const searchParams = useSearchParams();
  const {
    isLoading,
    error,
    getEventsForMonth,
    currentYear,
    currentMonth,
    scrollToDate,
    setScrollToDate,
    setCurrentMonth,
  } = useEvents();

  // Search state lifted up to share with sticky header
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [isSearching, setIsSearching] = useState(false);

  // Scroll detection for sticky header
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Get events for the current month from client-side cache
  const events = getEventsForMonth(currentYear, currentMonth);

  // Scroll detection effect
  useEffect(() => {
    const handleScroll = () => {
      if (controlsRef.current) {
        const rect = controlsRef.current.getBoundingClientRect();
        // Show sticky header when the controls section is scrolled out of view
        // We use a small buffer to trigger slightly before it's completely gone
        setShowStickyHeader(rect.bottom < 0);
      }
    };

    // Use passive listener for better scroll performance
    window.addEventListener("scroll", handleScroll, { passive: true });
    
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Today button handler for sticky header
  const handleTodayClick = useCallback(() => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1;
    const todayDate = now.toISOString().split("T")[0];

    if (currentYear === todayYear && currentMonth === todayMonth) {
      // Already on current month - scroll to today's date
      const allDateElements = document.querySelectorAll('[id^="date-"]');
      let targetElement: Element | null = null;

      const sortedElements = Array.from(allDateElements).sort((a, b) => {
        const dateA = a.id.replace("date-", "");
        const dateB = b.id.replace("date-", "");
        return dateA.localeCompare(dateB);
      });

      for (const el of sortedElements) {
        const elDate = el.id.replace("date-", "");
        if (elDate >= todayDate) {
          targetElement = el;
          break;
        }
      }

      if (!targetElement && sortedElements.length > 0) {
        targetElement = sortedElements[sortedElements.length - 1];
      }

      if (targetElement) {
        const yOffset = -100;
        const y = targetElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });

        targetElement.classList.add("scroll-highlight");
        setTimeout(() => {
          targetElement?.classList.remove("scroll-highlight");
        }, 2000);
      }
    } else {
      // Navigate to current month with scroll param
      setCurrentMonth(todayYear, todayMonth);
      setScrollToDate(todayDate);
    }
  }, [currentYear, currentMonth, setCurrentMonth, setScrollToDate]);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Sticky header - appears on scroll */}
      <StickyHeader
        selectedMonth={currentMonth}
        selectedYear={currentYear}
        onTodayClick={handleTodayClick}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearching={isSearching}
        isVisible={showStickyHeader}
      />

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

        {/* Controls section - ref for scroll detection */}
        <div ref={controlsRef}>
          {/* Month picker */}
          <MonthPicker />
        </div>

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
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearchingChange={setIsSearching}
          />
        )}
      </div>
    </main>
  );
}
