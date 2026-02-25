"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { CivicEvent } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CommitteeCacheEntry {
  events: CivicEvent[];
  total: number;
  fetchedAt: number;
}

interface CommitteeContextType {
  getCached: (
    committeeSlug: string,
    categoryName: string,
    limit: number
  ) => { events: CivicEvent[]; total: number } | null;
  setCached: (
    committeeSlug: string,
    categoryName: string,
    limit: number,
    data: { events: CivicEvent[]; total: number }
  ) => void;
}

const CommitteeContext = createContext<CommitteeContextType | null>(null);

function cacheKey(
  committeeSlug: string,
  categoryName: string,
  limit: number
): string {
  return `${committeeSlug}:${categoryName}:${limit}`;
}

export function CommitteeProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Record<string, CommitteeCacheEntry>>({});

  const getCached = useCallback(
    (
      committeeSlug: string,
      categoryName: string,
      limit: number
    ): { events: CivicEvent[]; total: number } | null => {
      const key = cacheKey(committeeSlug, categoryName, limit);
      const entry = cache[key];
      if (!entry) return null;
      if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
      return { events: entry.events, total: entry.total };
    },
    [cache]
  );

  const setCached = useCallback(
    (
      committeeSlug: string,
      categoryName: string,
      limit: number,
      data: { events: CivicEvent[]; total: number }
    ) => {
      const key = cacheKey(committeeSlug, categoryName, limit);
      setCache((prev) => ({
        ...prev,
        [key]: {
          ...data,
          fetchedAt: Date.now(),
        },
      }));
    },
    []
  );

  return (
    <CommitteeContext.Provider value={{ getCached, setCached }}>
      {children}
    </CommitteeContext.Provider>
  );
}

export function useCommitteeCache() {
  const context = useContext(CommitteeContext);
  if (!context) {
    return {
      getCached: () => null,
      setCached: () => {},
    };
  }
  return context;
}
