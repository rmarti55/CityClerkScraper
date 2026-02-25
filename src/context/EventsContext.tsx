"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import type { CivicEvent } from "@/lib/types";

interface EventsContextType {
  // All events loaded from API
  allEvents: CivicEvent[];
  // Loading state for initial fetch
  isLoading: boolean;
  // Error state
  error: string | null;
  // Get events filtered by month
  getEventsForMonth: (year: number, month: number) => CivicEvent[];
  // Current selected year/month
  currentYear: number;
  currentMonth: number;
  // Set current month (for navigation)
  setCurrentMonth: (year: number, month: number) => void;
  // Scroll target date
  scrollToDate: string | null;
  setScrollToDate: (date: string | null) => void;
  // Last fetched timestamp
  lastFetchedAt: string | null;
  // Manual refresh
  refresh: () => Promise<void>;
}

const EventsContext = createContext<EventsContextType | null>(null);

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = "cityclerk_events_cache_v3";

interface CachedData {
  events: CivicEvent[];
  fetchedAt: string;
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [allEvents, setAllEvents] = useState<CivicEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonthState] = useState(now.getMonth() + 1);
  const [scrollToDate, setScrollToDate] = useState<string | null>(null);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load from localStorage on mount
  const loadFromCache = useCallback((): CachedData | null => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached) as CachedData;
      }
    } catch (e) {
      console.warn("Failed to load events from cache:", e);
    }
    return null;
  }, []);

  // Save to localStorage
  const saveToCache = useCallback((events: CivicEvent[], fetchedAt: string) => {
    if (typeof window === "undefined") return;
    try {
      const data: CachedData = { events, fetchedAt };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save events to cache:", e);
    }
  }, []);

  // Fetch events for a month from API (dashboard is month-scoped, API-first).
  // Pass year/month when changing month so the request uses the new month before state updates.
  const fetchEvents = useCallback(
    async (showLoading = true, year?: number, month?: number) => {
      isFetchingRef.current = true;
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      const y = year ?? currentYear;
      const m = month ?? currentMonth;
      const monthParam = `${y}-${String(m).padStart(2, "0")}`;

      try {
        const response = await fetch(
          `/api/events?month=${monthParam}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch events: ${response.status}`);
        }
        const data = await response.json();
        if (!mountedRef.current) return;
        setAllEvents(data.events);
        setLastFetchedAt(data.fetchedAt);
        saveToCache(data.events, data.fetchedAt);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        if (mountedRef.current) setError(message);
        console.error("Failed to fetch events:", e);
      } finally {
        if (mountedRef.current) setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [saveToCache, currentYear, currentMonth]
  );

  // Filter events by month
  const getEventsForMonth = useCallback(
    (year: number, month: number): CivicEvent[] => {
      return allEvents.filter((event) => {
        const eventDate = new Date(event.startDateTime);
        return (
          eventDate.getFullYear() === year &&
          eventDate.getMonth() + 1 === month
        );
      });
    },
    [allEvents]
  );

  // Set current month — refetch events for the new month (pass year/month so request uses them immediately)
  const setCurrentMonth = useCallback((year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonthState(month);
    fetchEvents(false, year, month);
  }, [fetchEvents]);

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchEvents(false);
  }, [fetchEvents]);

  // Initial load: try cache first, then fetch
  useEffect(() => {
    const cached = loadFromCache();
    if (cached && cached.events.length > 0) {
      // Use cached data immediately
      setAllEvents(cached.events);
      setLastFetchedAt(cached.fetchedAt);
      setIsLoading(false);
      
      // Check if cache is stale (older than refresh interval)
      const cacheAge = Date.now() - new Date(cached.fetchedAt).getTime();
      if (cacheAge > REFRESH_INTERVAL_MS) {
        // Refresh in background
        fetchEvents(false);
      }
    } else {
      // No cache, fetch immediately
      fetchEvents(true);
    }
  }, [loadFromCache, fetchEvents]);

  // Set up periodic refresh
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      fetchEvents(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchEvents]);

  // Refresh on visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && lastFetchedAt) {
        const timeSinceLastFetch = Date.now() - new Date(lastFetchedAt).getTime();
        // Refresh if more than 5 minutes since last fetch
        if (timeSinceLastFetch > 5 * 60 * 1000) {
          fetchEvents(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchEvents, lastFetchedAt]);

  return (
    <EventsContext.Provider
      value={{
        allEvents,
        isLoading,
        error,
        getEventsForMonth,
        currentYear,
        currentMonth,
        setCurrentMonth,
        scrollToDate,
        setScrollToDate,
        lastFetchedAt,
        refresh,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventsContext);
  if (!context) {
    throw new Error("useEvents must be used within an EventsProvider");
  }
  return context;
}
