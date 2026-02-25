"use client";

import { useMemo, useState, useEffect } from "react";
import Fuse from "fuse.js";
import type { FuseResult, FuseResultMatch, IFuseOptions } from "fuse.js";
import { CivicEvent } from "@/lib/types";

export interface SearchResult {
  item: CivicEvent;
  score: number;
  matches: readonly FuseResultMatch[];
}

const fuseOptions: IFuseOptions<CivicEvent> = {
  keys: [
    { name: "eventName", weight: 3 },
    { name: "categoryName", weight: 2 },
    { name: "agendaName", weight: 1.5 },
    { name: "fileNames", weight: 1.5 }, // Search document/attachment names
    { name: "eventDescription", weight: 1 },
    { name: "venueName", weight: 0.5 },
    { name: "venueAddress", weight: 0.5 },
    { name: "venueCity", weight: 0.5 },
    { name: "venueState", weight: 0.3 },
    { name: "venueZip", weight: 0.3 },
  ],
  threshold: 0.4,
  includeMatches: true,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
};

/**
 * Custom hook for searching meetings using Fuse.js
 * @param events - Array of events to search
 * @param query - Search query string
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 */
export function useSearch(
  events: CivicEvent[],
  query: string,
  debounceMs: number = 300
): {
  results: SearchResult[];
  isSearching: boolean;
  debouncedQuery: string;
} {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce the search query
  useEffect(() => {
    if (query !== debouncedQuery) {
      setIsSearching(true);
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearching(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, debouncedQuery]);

  // Create Fuse instance (memoized to avoid re-creating on every render)
  const fuse = useMemo(() => {
    return new Fuse(events, fuseOptions);
  }, [events]);

  // Perform search
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return [];
    }

    const fuseResults: FuseResult<CivicEvent>[] = fuse.search(debouncedQuery);

    return fuseResults.map((result) => ({
      item: result.item,
      score: result.score ?? 0,
      matches: result.matches ?? [],
    }));
  }, [fuse, debouncedQuery]);

  return { results, isSearching, debouncedQuery };
}

/**
 * Highlight matched text in a string
 * Returns an array of segments with highlight flags
 */
export function getHighlightedSegments(
  text: string,
  matches: readonly FuseResultMatch[],
  fieldName: string
): { text: string; highlighted: boolean }[] {
  const fieldMatch = matches.find((m) => m.key === fieldName);

  if (!fieldMatch || !fieldMatch.indices || fieldMatch.indices.length === 0) {
    return [{ text, highlighted: false }];
  }

  const segments: { text: string; highlighted: boolean }[] = [];
  let lastIndex = 0;

  // Sort indices by start position
  const sortedIndices = [...fieldMatch.indices].sort((a, b) => a[0] - b[0]);

  for (const [start, end] of sortedIndices) {
    // Add non-highlighted text before this match
    if (start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, start),
        highlighted: false,
      });
    }

    // Add highlighted match
    segments.push({
      text: text.slice(start, end + 1),
      highlighted: true,
    });

    lastIndex = end + 1;
  }

  // Add remaining non-highlighted text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      highlighted: false,
    });
  }

  return segments;
}
