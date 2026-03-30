"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CivicEvent } from "@/lib/types";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useDocumentSearch } from "@/hooks/useDocumentSearch";
import { useTranscriptSearch } from "@/hooks/useTranscriptSearch";
import { useEvents } from "@/context/EventsContext";
import { useSearch } from "@/context/SearchContext";
import { GlobalSearchResults } from "./GlobalSearchResults";
import { DocumentSearchResults } from "./DocumentSearchResults";
import { TranscriptSearchResults } from "./TranscriptSearchResults";
import { MeetingList } from "./MeetingList";
import { MobileSearchModal } from "./MobileSearchModal";

type SearchMode = "meetings" | "documents" | "transcripts";

const DATA_START_YEAR = 2024;
const DATA_START_MONTH = 6;

interface SearchableContentProps {
  events: CivicEvent[];
  year: number;
  month: number;
  scrollToDate?: string;
}

export function SearchableContent({ 
  events, 
  year, 
  month, 
  scrollToDate,
}: SearchableContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const { setScrollToDate } = useEvents();
  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setIsSearching,
    isMobileSearchOpen,
    setIsMobileSearchOpen,
    history,
    removeSearch,
  } = useSearch();

  const [searchMode, setSearchMode] = useState<SearchMode>("meetings");

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

  const {
    results: transcriptResults,
    isLoading: transcriptLoading,
    error: transcriptError,
    debouncedQuery: transcriptQuery,
  } = useTranscriptSearch(searchQuery);

  const hasSearchQuery = debouncedQuery.trim().length >= 2;
  const hasCategory = selectedCategory !== null;
  const isShowingFilteredResults = hasSearchQuery || hasCategory;
  const isShowingDocumentSearch = searchMode === "documents" && documentQuery.trim().length >= 2;
  const isShowingTranscriptSearch = searchMode === "transcripts" && transcriptQuery.trim().length >= 2;

  const prevIsLoadingRef = useRef(isLoading);

  const effectiveLoading = isShowingTranscriptSearch
    ? transcriptLoading
    : isShowingDocumentSearch
    ? documentLoading
    : isLoading;
  useEffect(() => {
    if (prevIsLoadingRef.current !== effectiveLoading) {
      prevIsLoadingRef.current = effectiveLoading;
      setIsSearching(effectiveLoading);
    }
  }, [effectiveLoading, setIsSearching]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery);
    } else {
      params.delete("q");
    }
    
    if (selectedCategory) {
      params.set("category", String(selectedCategory.id));
    } else {
      params.delete("category");
    }
    
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [debouncedQuery, selectedCategory, pathname, router]);

  const handleMobileSearchClose = useCallback(() => {
    setIsMobileSearchOpen(false);
  }, [setIsMobileSearchOpen]);
  
  const isBeforeDataStart = year < DATA_START_YEAR || 
    (year === DATA_START_YEAR && month < DATA_START_MONTH);

  const handleScrollComplete = useCallback(() => {
    setScrollToDate(null);
  }, [setScrollToDate]);

  return (
    <div>
      {/* Mobile full-screen search modal */}
      <MobileSearchModal
        isOpen={isMobileSearchOpen}
        onClose={handleMobileSearchClose}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        recentSearches={history}
        onSelectRecentSearch={setSearchQuery}
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
                : "text-gray-800 hover:text-gray-900"
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
                : "text-gray-800 hover:text-gray-900"
            }`}
          >
            Documents
          </button>
          <button
            type="button"
            onClick={() => setSearchMode("transcripts")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              searchMode === "transcripts"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-800 hover:text-gray-900"
            }`}
          >
            Transcripts
          </button>
        </div>
      )}

      {/* Conditional content: transcript search, document search, filtered results, or meeting list */}
      {isShowingTranscriptSearch ? (
        <TranscriptSearchResults
          results={transcriptResults}
          query={transcriptQuery}
          isLoading={transcriptLoading}
          error={transcriptError}
        />
      ) : isShowingDocumentSearch ? (
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
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-800 mb-2">No records available</p>
          <p className="text-gray-600 max-w-md mx-auto">
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
