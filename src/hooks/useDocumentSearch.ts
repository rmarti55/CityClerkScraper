"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { DocumentSearchResult } from "@/lib/types";

interface UseDocumentSearchResult {
  results: DocumentSearchResult[];
  isLoading: boolean;
  error: string | null;
  debouncedQuery: string;
}

interface DocumentSearchResponse {
  results: DocumentSearchResult[];
}

const fetcher = (url: string): Promise<DocumentSearchResponse> =>
  fetch(url).then((r) => {
    if (!r.ok) throw r.json().then((d: { error?: string }) => new Error(d.error ?? "Document search failed"));
    return r.json();
  });

export function useDocumentSearch(
  query: string,
  debounceMs: number = 300
): UseDocumentSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const trimmed = debouncedQuery.trim();
  const key = trimmed.length >= 2
    ? `/api/search/documents?${new URLSearchParams({ q: trimmed })}`
    : null;

  const { data, error: swrError, isLoading } = useSWR<DocumentSearchResponse>(
    key,
    fetcher,
    { keepPreviousData: true }
  );

  return {
    results: data?.results ?? [],
    isLoading,
    error: swrError ? (swrError instanceof Error ? swrError.message : "Document search failed") : null,
    debouncedQuery,
  };
}
