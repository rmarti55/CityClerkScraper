"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";

export interface TranscriptSearchHit {
  transcriptId: number;
  eventId: number;
  eventName: string;
  eventDate: string;
  categoryName: string;
  videoTitle: string | null;
  youtubeVideoId: string | null;
  snippet: string;
}

interface TranscriptSearchResponse {
  results: TranscriptSearchHit[];
}

interface UseTranscriptSearchResult {
  results: TranscriptSearchHit[];
  isLoading: boolean;
  error: string | null;
  debouncedQuery: string;
}

const fetcher = (url: string): Promise<TranscriptSearchResponse> =>
  fetch(url).then((r) => {
    if (!r.ok) throw r.json().then((d: { error?: string }) => new Error(d.error ?? "Transcript search failed"));
    return r.json();
  });

export function useTranscriptSearch(
  query: string,
  debounceMs: number = 300
): UseTranscriptSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const trimmed = debouncedQuery.trim();
  const key = trimmed.length >= 2
    ? `/api/transcripts/search?${new URLSearchParams({ q: trimmed })}`
    : null;

  const { data, error: swrError, isLoading } = useSWR<TranscriptSearchResponse>(
    key,
    fetcher,
    { keepPreviousData: true }
  );

  return {
    results: data?.results ?? [],
    isLoading,
    error: swrError ? (swrError instanceof Error ? swrError.message : "Transcript search failed") : null,
    debouncedQuery,
  };
}
