"use client";

import { useState, useEffect } from "react";

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

interface UseTranscriptSearchResult {
  results: TranscriptSearchHit[];
  isLoading: boolean;
  error: string | null;
  debouncedQuery: string;
}

export function useTranscriptSearch(
  query: string,
  debounceMs: number = 300
): UseTranscriptSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<TranscriptSearchHit[]>([]);
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
          `/api/transcripts/search?${new URLSearchParams({ q: trimmed })}`,
          { signal: abortController.signal }
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Transcript search failed");
        }
        const data: { results: TranscriptSearchHit[] } = await res.json();
        setResults(data.results ?? []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Transcript search failed");
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
