"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import { useEvents } from "@/context/EventsContext";
import { Category } from "@/hooks/useCategories";
import { LoginButton } from "./LoginButton";
import { CategoryFilter } from "./CategoryFilter";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface StickyHeaderProps {
  selectedMonth: number;
  selectedYear: number;
  onTodayClick: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
  isVisible: boolean;
  hasActiveFilter?: boolean;
  meetingCount: number;
  withAttachmentsCount: number;
  totalFilesCount: number;
  selectedCategory: Category | null;
  onSelectCategory: (category: Category | null) => void;
}

export function StickyHeader({
  selectedMonth,
  selectedYear,
  onTodayClick,
  searchQuery,
  onSearchChange,
  isSearching = false,
  isVisible,
  hasActiveFilter = false,
  meetingCount,
  withAttachmentsCount,
  totalFilesCount,
  selectedCategory,
  onSelectCategory,
}: StickyHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setCurrentMonth, setScrollToDate } = useEvents();

  const handleClear = useCallback(() => {
    onSearchChange("");
    inputRef.current?.focus();
  }, [onSearchChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleClear]
  );

  const navigateToMonth = useCallback(
    (year: number, month: number, scrollTo?: string) => {
      setCurrentMonth(year, month);
      setScrollToDate(scrollTo ?? null);
    },
    [setCurrentMonth, setScrollToDate]
  );

  const goToPrevMonth = useCallback(() => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    navigateToMonth(newYear, newMonth);
  }, [selectedMonth, selectedYear, navigateToMonth]);

  const goToNextMonth = useCallback(() => {
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    navigateToMonth(newYear, newMonth);
  }, [selectedMonth, selectedYear, navigateToMonth]);

  const monthName = MONTHS[selectedMonth - 1];
  const monthShort = MONTHS_SHORT[selectedMonth - 1];
  const summariesText = `${meetingCount} meetings · ${withAttachmentsCount} with attachments · ${totalFilesCount} total files`;
  const summariesTextShort = `${meetingCount} mtgs · ${withAttachmentsCount} w/ files · ${totalFilesCount} files`;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 sticky-header ${
        isVisible ? "sticky-header-visible" : "sticky-header-hidden"
      }`}
    >
      <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-2 sm:py-2.5">
          {/* Desktop layout */}
          <div className="hidden sm:flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-shrink-0">
                <LoginButton />
              </div>
              <Link
                href="/governing-body"
                className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Governing Body</span>
              </Link>
              {/* Date selector: prev | month year | next */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Previous month"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-semibold text-gray-900 min-w-[7rem] text-center">
                  {monthName} {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Next month"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="flex-shrink-0">
                <CategoryFilter
                  selectedCategory={selectedCategory}
                  onSelectCategory={onSelectCategory}
                  compact
                />
              </div>
              <div className="relative flex-1 min-w-0 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  {isSearching ? (
                    <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search meetings..."
                  className="block w-full pl-8 pr-7 py-1.5 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {!hasActiveFilter && (
                <button
                  onClick={onTodayClick}
                  className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0"
                >
                  Today
                </button>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate" title={summariesText}>
              {summariesText}
            </div>
          </div>

          {/* Mobile layout: row 1 = profile, gov, date, filter, today; row 2 = search + summaries */}
          <div className="sm:hidden flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap min-h-[44px]">
              <div className="flex-shrink-0">
                <LoginButton />
              </div>
              <Link
                href="/governing-body"
                className="flex items-center justify-center w-9 h-9 min-w-[44px] min-h-[44px] rounded-lg text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label="Governing Body"
              >
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </Link>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Previous month"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs font-semibold text-gray-900 min-w-[4.5rem] text-center">
                  {monthShort} &apos;{String(selectedYear).slice(2)}
                </span>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Next month"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="flex-shrink-0 min-h-[44px] flex items-center">
                <CategoryFilter
                  selectedCategory={selectedCategory}
                  onSelectCategory={onSelectCategory}
                  compact
                />
              </div>
              {!hasActiveFilter && (
                <button
                  onClick={onTodayClick}
                  className="px-2.5 py-2 min-h-[44px] text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0"
                >
                  Today
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                {isSearching ? (
                  <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="block w-full pl-8 pr-7 py-2 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate" title={summariesText}>
              {summariesTextShort}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
