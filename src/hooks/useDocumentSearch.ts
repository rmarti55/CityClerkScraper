"use client";

import { useState, useEffect, useRef } from "react";
import type { DocumentSearchResult } from "@/lib/types";

interface UseDocumentSearchResult {
  results: DocumentSearchResult[];
  isLoading: boolean;
  error: string | null;
  debouncedQuery: string;
}

/**
 * Hook for Civic Clerk document search (GET /api/search/documents).
 * Searches inside meeting documents and agenda items; returns events with matching files/items.
 */
export function useDocumentSearch(
  query: string,
  debounceMs: number = 300
): UseDocumentSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchResults = async () => {
      const trimmed = debouncedQuery.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/search/documents?${new URLSearchParams({ q: trimmed })}`,
          { signal: abortController.signal }
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Document search failed");
        }
        const data: { results: DocumentSearchResult[] } = await res.json();
        setResults(data.results ?? []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Document search failed");
        setResults([]);
      } finally {
        if (!abortController.signal.aborted) setIsLoading(false);
      }
    };

    fetchResults();
    return () => abortController.abort();
  }, [debouncedQuery]);

  return { results, isLoading, error, debouncedQuery };
}
