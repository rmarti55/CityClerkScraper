"use client";

import { useState } from "react";
import { CivicEvent } from "@/lib/types";
import { useSearch } from "@/hooks/useSearch";
import { SearchBar } from "./SearchBar";
import { SearchResults } from "./SearchResults";
import { MeetingList } from "./MeetingList";

interface SearchableContentProps {
  events: CivicEvent[];
}

export function SearchableContent({ events }: SearchableContentProps) {
  const [query, setQuery] = useState("");
  const { results, isSearching, debouncedQuery } = useSearch(events, query);

  const isShowingResults = debouncedQuery.trim().length > 0;

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6">
        <SearchBar
          value={query}
          onChange={setQuery}
          isSearching={isSearching}
        />
      </div>

      {/* Conditional content: search results or meeting list */}
      {isShowingResults ? (
        <SearchResults results={results} query={debouncedQuery} />
      ) : (
        <MeetingList events={events} />
      )}
    </div>
  );
}
