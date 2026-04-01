"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import type { CivicEvent } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CommitteeCacheEntry {
  extraEvents: CivicEvent[];
  total: number;
  currentPage: number;
  fetchedAt: number;
}

interface CachedState {
  extraEvents: CivicEvent[];
  total: number;
  currentPage: number;
}

interface CommitteeContextType {
  getCached: (
    committeeSlug: string,
    categoryName: string,
    limit: number
  ) => CachedState | null;
  setCached: (
    committeeSlug: string,
    categoryName: string,
    limit: number,
    data: CachedState
  ) => void;
  setLastClicked: (committeeSlug: string, meetingId: number) => void;
  getLastClicked: (committeeSlug: string) => number | null;
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
  const lastClickedRef = useRef<Record<string, number>>({});

  const getCached = useCallback(
    (
      committeeSlug: string,
      categoryName: string,
      limit: number
    ): CachedState | null => {
      const key = cacheKey(committeeSlug, categoryName, limit);
      const entry = cache[key];
      if (!entry) return null;
      if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
      return {
        extraEvents: entry.extraEvents,
        total: entry.total,
        currentPage: entry.currentPage,
      };
    },
    [cache]
  );

  const setCached = useCallback(
    (
      committeeSlug: string,
      categoryName: string,
      limit: number,
      data: CachedState
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

  const setLastClicked = useCallback(
    (committeeSlug: string, meetingId: number) => {
      lastClickedRef.current[committeeSlug] = meetingId;
    },
    []
  );

  const getLastClicked = useCallback(
    (committeeSlug: string): number | null => {
      const id = lastClickedRef.current[committeeSlug];
      if (id !== undefined) {
        delete lastClickedRef.current[committeeSlug];
        return id;
      }
      return null;
    },
    []
  );

  return (
    <CommitteeContext.Provider value={{ getCached, setCached, setLastClicked, getLastClicked }}>
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
      setLastClicked: () => {},
      getLastClicked: () => null,
    } as CommitteeContextType;
  }
  return context;
}
