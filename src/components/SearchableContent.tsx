"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CivicEvent } from "@/lib/types";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useCategoryFilter } from "@/hooks/useCategoryFilter";
import { useEvents } from "@/context/EventsContext";
import { SearchBar } from "./SearchBar";
import { GlobalSearchResults } from "./GlobalSearchResults";
import { CategoryFilterResults } from "./CategoryFilterResults";
import { CategoryFilter } from "./CategoryFilter";
import { MeetingList } from "./MeetingList";
import { Category } from "@/hooks/useCategories";

// Data availability: CivicClerk data starts June 2024
const DATA_START_YEAR = 2024;
const DATA_START_MONTH = 6;

interface SearchableContentProps {
  events: CivicEvent[];
  year: number;
  month: number;
  scrollToDate?: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchingChange: (isSearching: boolean) => void;
  selectedCategory: Category | null;
  onSelectCategory: (category: Category | null) => void;
}

export function SearchableContent({ 
  events, 
  year, 
  month, 
  scrollToDate,
  searchQuery,
  onSearchQueryChange,
  onSearchingChange,
  selectedCategory,
  onSelectCategory,
}: SearchableContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const { setScrollToDate } = useEvents();
  const { history, addSearch, removeSearch } = useSearchHistory();
  const {
    results: searchResults,
    total: searchTotal,
    isLoading: searchIsLoading,
    error: searchError,
    debouncedQuery,
  } = useGlobalSearch(searchQuery);

  const {
    results: categoryResults,
    total: categoryTotal,
    page: categoryPage,
    totalPages: categoryTotalPages,
    isLoading: categoryIsLoading,
    error: categoryError,
    setPage: setCategoryPage,
  } = useCategoryFilter(selectedCategory?.name || null);

  const isShowingSearchResults = debouncedQuery.trim().length >= 2;
  const isShowingCategoryResults = selectedCategory !== null && !isShowingSearchResults;

  // Combined loading state
  const isLoading = searchIsLoading || categoryIsLoading;

  // Track previous loading state to prevent infinite loop
  const prevIsLoadingRef = useRef(isLoading);

  // Notify parent of searching state changes
  useEffect(() => {
    if (prevIsLoadingRef.current !== isLoading) {
      prevIsLoadingRef.current = isLoading;
      onSearchingChange(isLoading);
    }
  }, [isLoading, onSearchingChange]);

  // Sync search query to URL when debounced query changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery);
    } else {
      params.delete("q");
    }
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [debouncedQuery, pathname, router]);

  // Save search to history when search completes successfully
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    // Detect when loading transitions from true to false (search completed)
    if (wasLoadingRef.current && !searchIsLoading) {
      // Save if we have a valid query and results
      if (debouncedQuery.trim().length >= 2 && searchResults.length > 0) {
        addSearch(debouncedQuery);
      }
    }
    wasLoadingRef.current = searchIsLoading;
  }, [searchIsLoading, debouncedQuery, searchResults.length, addSearch]);
  
  // Check if viewing a month before data availability
  const isBeforeDataStart = year < DATA_START_YEAR || 
    (year === DATA_START_YEAR && month < DATA_START_MONTH);

  // Clear scrollToDate after scroll completes
  const handleScrollComplete = useCallback(() => {
    setScrollToDate(null);
  }, [setScrollToDate]);

  return (
    <div>
      {/* Search bar and category filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-stretch">
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={onSearchQueryChange}
            isSearching={isLoading}
            recentSearches={history}
            onSelectRecentSearch={onSearchQueryChange}
            onRemoveRecentSearch={removeSearch}
          />
        </div>
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
        />
      </div>

      {/* Conditional content: search results, category results, or meeting list */}
      {isShowingSearchResults ? (
        <GlobalSearchResults
          results={searchResults}
          query={debouncedQuery}
          total={searchTotal}
          isLoading={searchIsLoading}
          error={searchError}
        />
      ) : isShowingCategoryResults ? (
        <CategoryFilterResults
          results={categoryResults}
          category={selectedCategory!}
          total={categoryTotal}
          page={categoryPage}
          totalPages={categoryTotalPages}
          isLoading={categoryIsLoading}
          error={categoryError}
          onPageChange={setCategoryPage}
          onClearFilter={() => onSelectCategory(null)}
        />
      ) : events.length === 0 && isBeforeDataStart ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-700 mb-2">No records available</p>
          <p className="text-gray-500 max-w-md mx-auto">
            Meeting records prior to June 2024 are not available in this system. 
            The City of Santa Fe migrated to a new platform at that time.
          </p>
        </div>
      ) : (
        <MeetingList 
          events={events} 
          scrollToDate={scrollToDate} 
          onScrollComplete={handleScrollComplete}
        />
      )}
    </div>
  );
}
