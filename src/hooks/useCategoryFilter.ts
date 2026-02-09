"use client";

import { useState, useEffect, useCallback } from "react";
import { CivicEvent } from "@/lib/types";

interface FilterResponse {
  events: CivicEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseCategoryFilterResult {
  results: CivicEvent[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
}

/**
 * Hook for filtering events by category with pagination
 */
export function useCategoryFilter(
  categoryName: string | null,
  limit: number = 20
): UseCategoryFilterResult {
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<CivicEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset page when category changes
  useEffect(() => {
    setPage(1);
  }, [categoryName]);

  // Fetch filtered results
  useEffect(() => {
    const fetchResults = async () => {
      if (!categoryName) {
        setResults([]);
        setTotal(0);
        setTotalPages(0);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          categoryName,
          page: page.toString(),
          limit: limit.toString(),
        });

        const response = await fetch(`/api/events/by-category?${params}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Filter failed");
        }

        const data: FilterResponse = await response.json();
        setResults(data.events);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (err) {
        console.error("Category filter error:", err);
        setError(err instanceof Error ? err.message : "Filter failed");
        setResults([]);
        setTotal(0);
        setTotalPages(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [categoryName, page, limit]);

  const handleSetPage = useCallback(
    (newPage: number) => {
      setPage(Math.max(1, Math.min(newPage, totalPages || 1)));
    },
    [totalPages]
  );

  return {
    results,
    total,
    page,
    totalPages,
    isLoading,
    error,
    setPage: handleSetPage,
  };
}
