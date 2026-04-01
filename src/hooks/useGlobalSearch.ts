"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
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

const fetcher = (url: string): Promise<SearchResponse> =>
  fetch(url).then((r) => {
    if (!r.ok) throw r.json().then((d: { error?: string }) => new Error(d.error || "Search failed"));
    return r.json();
  });

function buildSearchKey(query: string, categoryName?: string | null): string | null {
  const hasValidQuery = query.trim().length >= 2;
  const hasCategory = categoryName && categoryName.trim().length > 0;

  if (!hasValidQuery && !hasCategory) return null;

  const params = new URLSearchParams();
  if (hasValidQuery) params.set("q", query.trim());
  if (hasCategory) params.set("categoryName", categoryName.trim());

  return `/api/search?${params}`;
}

export function useGlobalSearch(
  query: string,
  categoryName?: string | null,
  debounceMs: number = 300
): UseGlobalSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const key = buildSearchKey(debouncedQuery, categoryName);

  const { data, error: swrError, isLoading } = useSWR<SearchResponse>(
    key,
    fetcher,
    { keepPreviousData: true }
  );

  return {
    results: data?.events ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: swrError ? (swrError instanceof Error ? swrError.message : "Search failed") : null,
    debouncedQuery,
  };
}
