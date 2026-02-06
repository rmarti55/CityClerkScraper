"use client";

import { useState, useEffect, useCallback } from "react";
import { CivicEvent } from "@/lib/types";

interface SearchResponse {
  events: CivicEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseGlobalSearchResult {
  results: CivicEvent[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  debouncedQuery: string;
}

/**
 * Hook for server-side search across all events with pagination
 */
export function useGlobalSearch(
  query: string,
  debounceMs: number = 300,
  limit: number = 20
): UseGlobalSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<CivicEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the query and set loading so the first paint shows the skeleton
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      // Reset to page 1 when query changes
      if (query !== debouncedQuery) {
        setPage(1);
      }
      const trimmed = query.trim();
      if (trimmed.length >= 2) {
        setIsLoading(true);
      } else {
        setIsLoading(false);
        setResults([]);
        setTotal(0);
        setTotalPages(0);
        setError(null);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, debouncedQuery]);

  // Fetch search results
  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
        setResults([]);
        setTotal(0);
        setTotalPages(0);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: debouncedQuery.trim(),
          page: page.toString(),
          limit: limit.toString(),
        });

        const response = await fetch(`/api/search?${params}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Search failed");
        }

        const data: SearchResponse = await response.json();
        setResults(data.events);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (err) {
        console.error("Search error:", err);
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
        setTotal(0);
        setTotalPages(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery, page, limit]);

  const handleSetPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages || 1)));
  }, [totalPages]);

  return {
    results,
    total,
    page,
    totalPages,
    isLoading,
    error,
    setPage: handleSetPage,
    debouncedQuery,
  };
}
