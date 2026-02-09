"use client";

import { useState, useEffect, useRef } from "react";
import { CivicEvent } from "@/lib/types";

interface SearchResponse {
  events: CivicEvent[];
  total: number;
}

interface UseGlobalSearchResult {
  results: CivicEvent[];
  total: number;
  isLoading: boolean;
  error: string | null;
  debouncedQuery: string;
}

/**
 * Hook for server-side search across all events
 */
export function useGlobalSearch(
  query: string,
  debounceMs: number = 300
): UseGlobalSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<CivicEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevQueryRef = useRef(query);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      prevQueryRef.current = query;
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setIsLoading(false);
        setResults([]);
        setTotal(0);
        setError(null);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Fetch search results with AbortController to cancel stale requests
  useEffect(() => {
    const abortController = new AbortController();

    const fetchResults = async () => {
      if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
        setResults([]);
        setTotal(0);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: debouncedQuery.trim(),
        });

        const response = await fetch(`/api/search?${params}`, {
          signal: abortController.signal,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Search failed");
        }

        const data: SearchResponse = await response.json();
        setResults(data.events);
        setTotal(data.total);
      } catch (err) {
        // Ignore abort errors - they're expected when cancelling
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("Search error:", err);
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
        setTotal(0);
      } finally {
        // Only update loading state if request wasn't aborted
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchResults();

    // Cleanup: abort the request when dependencies change or component unmounts
    return () => abortController.abort();
  }, [debouncedQuery]);

  return {
    results,
    total,
    isLoading,
    error,
    debouncedQuery,
  };
}
