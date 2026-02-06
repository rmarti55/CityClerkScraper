"use client";

import { useState } from "react";
import { CivicEvent } from "@/lib/types";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { SearchBar } from "./SearchBar";
import { GlobalSearchResults } from "./GlobalSearchResults";
import { MeetingList } from "./MeetingList";

interface SearchableContentProps {
  events: CivicEvent[];
}

export function SearchableContent({ events }: SearchableContentProps) {
  const [query, setQuery] = useState("");
  const {
    results,
    total,
    page,
    totalPages,
    isLoading,
    error,
    setPage,
    debouncedQuery,
  } = useGlobalSearch(query);

  const isShowingResults = debouncedQuery.trim().length >= 2;

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6">
        <SearchBar
          value={query}
          onChange={setQuery}
          isSearching={isLoading}
        />
      </div>

      {/* Conditional content: search results or meeting list */}
      {isShowingResults ? (
        <GlobalSearchResults
          results={results}
          query={debouncedQuery}
          total={total}
          page={page}
          totalPages={totalPages}
          isLoading={isLoading}
          error={error}
          onPageChange={setPage}
        />
      ) : (
        <MeetingList events={events} />
      )}
    </div>
  );
}
