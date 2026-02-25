"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CivicEvent } from "@/lib/types";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useDocumentSearch } from "@/hooks/useDocumentSearch";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useEvents } from "@/context/EventsContext";
import { SearchBar } from "./SearchBar";
import { GlobalSearchResults } from "./GlobalSearchResults";
import { DocumentSearchResults } from "./DocumentSearchResults";
import { CategoryFilter } from "./CategoryFilter";
import { MeetingList } from "./MeetingList";
import { MobileSearchModal } from "./MobileSearchModal";
import { Category } from "@/hooks/useCategories";

type SearchMode = "meetings" | "documents";

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
  
  // Mobile search modal state
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  // Search mode: meetings (DB) vs documents (Civic Clerk Search API)
  const [searchMode, setSearchMode] = useState<SearchMode>("meetings");

  // Unified search hook that handles both search term and category filter
  const {
    results: searchResults,
    total: searchTotal,
    isLoading,
    error: searchError,
    debouncedQuery,
  } = useGlobalSearch(searchQuery, selectedCategory?.name);

  const {
    results: documentResults,
    isLoading: documentLoading,
    error: documentError,
    debouncedQuery: documentQuery,
  } = useDocumentSearch(searchQuery);

  // Determine if we're showing filtered results (search, category, or both)
  const hasSearchQuery = debouncedQuery.trim().length >= 2;
  const hasCategory = selectedCategory !== null;
  const isShowingFilteredResults = hasSearchQuery || hasCategory;
  const isShowingDocumentSearch = searchMode === "documents" && documentQuery.trim().length >= 2;

  // Track previous loading state to prevent infinite loop
  const prevIsLoadingRef = useRef(isLoading);

  // Notify parent of searching state changes
  const effectiveLoading = isShowingDocumentSearch ? documentLoading : isLoading;
  useEffect(() => {
    if (prevIsLoadingRef.current !== effectiveLoading) {
      prevIsLoadingRef.current = effectiveLoading;
      onSearchingChange(effectiveLoading);
    }
  }, [effectiveLoading, onSearchingChange]);

  // Sync search query and category filter to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Sync search query
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery);
    } else {
      params.delete("q");
    }
    
    // Sync category filter
    if (selectedCategory) {
      params.set("category", String(selectedCategory.id));
    } else {
      params.delete("category");
    }
    
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [debouncedQuery, selectedCategory, pathname, router]);

  // Handle explicit search submission (Enter key)
  const handleSearchSubmit = useCallback((query: string) => {
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      addSearch(trimmed);
    }
  }, [addSearch]);

  // Mobile search modal handlers
  const handleMobileSearchOpen = useCallback(() => {
    setIsMobileSearchOpen(true);
  }, []);

  const handleMobileSearchClose = useCallback(() => {
    setIsMobileSearchOpen(false);
  }, []);
  
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
            onSubmit={handleSearchSubmit}
            isSearching={isLoading}
            recentSearches={history}
            onSelectRecentSearch={onSearchQueryChange}
            onRemoveRecentSearch={removeSearch}
            onMobileSearchOpen={handleMobileSearchOpen}
          />
        </div>
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
        />
      </div>

      {/* Mobile full-screen search modal */}
      <MobileSearchModal
        isOpen={isMobileSearchOpen}
        onClose={handleMobileSearchClose}
        searchQuery={searchQuery}
        onSearchChange={onSearchQueryChange}
        recentSearches={history}
        onSelectRecentSearch={onSearchQueryChange}
        onRemoveRecentSearch={removeSearch}
        searchResults={searchResults}
        searchTotal={searchTotal}
        isSearching={isLoading}
        searchError={searchError}
        debouncedQuery={debouncedQuery}
      />

      {/* Search mode tabs when user has a search query */}
      {hasSearchQuery && (
        <div className="flex gap-1 p-1 mb-4 rounded-lg bg-gray-100 w-fit">
          <button
            type="button"
            onClick={() => setSearchMode("meetings")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              searchMode === "meetings"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Meetings
          </button>
          <button
            type="button"
            onClick={() => setSearchMode("documents")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              searchMode === "documents"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Documents
          </button>
        </div>
      )}

      {/* Conditional content: document search, filtered results, or meeting list */}
      {isShowingDocumentSearch ? (
        <DocumentSearchResults
          results={documentResults}
          query={documentQuery}
          isLoading={documentLoading}
          error={documentError}
        />
      ) : isShowingFilteredResults ? (
        <GlobalSearchResults
          results={searchResults}
          query={debouncedQuery}
          total={searchTotal}
          isLoading={isLoading}
          error={searchError}
          categoryName={selectedCategory?.name}
          categoryId={selectedCategory?.id}
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
