"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEvents } from "@/context/EventsContext";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/branding";
import { MonthPicker } from "./MonthPicker";
import { SearchableContent } from "./SearchableContent";
import { StickyHeader } from "./StickyHeader";
import { MeetingListSkeleton } from "./skeletons/MeetingCardSkeleton";
import { Category, useCategories } from "@/hooks/useCategories";
import { LoginButton } from "./LoginButton";

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

const MONTH_PARAM_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PARAM_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function HomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const {
    isLoading,
    error,
    getEventsForMonth,
    currentYear,
    currentMonth,
    scrollToDate,
    setScrollToDate,
    setCurrentMonth,
    refresh,
  } = useEvents();

  // Refetch whenever user lands on dashboard (e.g. open app or "Back to meetings") so list and file counts stay fresh
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch categories to restore filter from URL
  const { categories } = useCategories();

  // Search state lifted up to share with sticky header
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [isSearching, setIsSearching] = useState(false);
  
  // Category filter state - initialized from URL if present
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  // Restore category filter from URL when categories are loaded
  useEffect(() => {
    const categoryIdParam = searchParams.get("category");
    if (categoryIdParam && categories.length > 0) {
      const categoryId = parseInt(categoryIdParam, 10);
      const foundCategory = categories.find((c) => c.id === categoryId);
      if (foundCategory) {
        setSelectedCategory(foundCategory);
      }
    }
  }, [categories, searchParams]);

  // Restore calendar view from URL (back/forward, shared links)
  useEffect(() => {
    const monthParam = searchParams.get("month");
    if (monthParam && MONTH_PARAM_REGEX.test(monthParam)) {
      const [y, m] = monthParam.split("-").map((n) => parseInt(n, 10));
      if (m >= 1 && m <= 12 && y >= 2020 && y <= 2030) {
        setCurrentMonth(y, m);
      }
    }
    const dateParam = searchParams.get("date");
    if (dateParam && DATE_PARAM_REGEX.test(dateParam)) {
      const d = new Date(dateParam + "T12:00:00");
      if (!Number.isNaN(d.getTime())) {
        setScrollToDate(dateParam);
      }
    }
  }, [searchParams, setCurrentMonth, setScrollToDate]);

  // Compute whether filters are active (for hiding Today button)
  const hasActiveFilter = searchQuery.trim().length >= 2 || selectedCategory !== null;

  // Sync calendar view to URL so back from meeting detail returns to same view.
  // When scrollToDate is cleared after scroll, keep date= in URL so "Back to meetings" restores scroll.
  useEffect(() => {
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    const currentMonthParam = searchParams.get("month");
    const currentDateParam = searchParams.get("date") ?? null;
    const effectiveDate = scrollToDate ?? currentDateParam;
    if (currentMonthParam === monthStr && currentDateParam === effectiveDate) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", monthStr);
    if (scrollToDate) {
      params.set("date", scrollToDate);
    }
    // When scrollToDate is null (e.g. after scroll complete), leave date in URL so Back restores scroll
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [currentYear, currentMonth, scrollToDate, pathname, router, searchParams]);

  // Open on today: set scroll target when viewing current month with no active filter (desktop and mobile)
  useEffect(() => {
    if (hasActiveFilter) return;
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1;
    if (currentYear === todayYear && currentMonth === todayMonth) {
      setScrollToDate(now.toISOString().split("T")[0]);
    }
  }, [hasActiveFilter, currentYear, currentMonth, setScrollToDate]);

  // Scroll detection for sticky header
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Get events for the current month from client-side cache
  const events = getEventsForMonth(currentYear, currentMonth);

  // Summary stats for sticky header (same formula as MeetingList)
  const meetingCount = events.length;
  const withAttachmentsCount = events.filter((e) => (e.fileCount || 0) > 0).length;
  const totalFilesCount = events.reduce((sum, e) => sum + (e.fileCount || 0), 0);

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
        window.scrollTo({ top: y, behavior: "auto" });

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
        hasActiveFilter={hasActiveFilter}
        meetingCount={meetingCount}
        withAttachmentsCount={withAttachmentsCount}
        totalFilesCount={totalFilesCount}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {SITE_NAME}
            </h1>
            <p className="text-gray-500 mt-1">
              {SITE_DESCRIPTION}
            </p>
          </div>
          <LoginButton />
        </div>

        {/* Quick access to committees */}
        <div className="mb-6">
          <Link
            href="/governing-body"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-indigo-700 font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Governing Body
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Controls section - ref for scroll detection */}
        <div ref={controlsRef}>
          {/* Month picker */}
          <MonthPicker hasActiveFilter={hasActiveFilter} />
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
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        )}
      </div>
    </main>
  );
}
