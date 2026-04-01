"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import type { CivicEvent } from "@/lib/types";
import { getNowInDenver, getEventDateKeyInDenver } from "@/lib/datetime";

interface EventsApiResponse {
  events: CivicEvent[];
  count: number;
  fetchedAt: string;
}

const fetcher = (url: string): Promise<EventsApiResponse> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Failed to fetch events: ${r.status}`);
    return r.json();
  });

interface EventsContextType {
  allEvents: CivicEvent[];
  isLoading: boolean;
  error: string | null;
  getEventsForMonth: (year: number, month: number) => CivicEvent[];
  currentYear: number;
  currentMonth: number;
  setCurrentMonth: (year: number, month: number) => void;
  scrollToDate: string | null;
  setScrollToDate: (date: string | null) => void;
  lastFetchedAt: string | null;
  refresh: () => Promise<void>;
  updateEvent: (event: CivicEvent) => void;
}

const EventsContext = createContext<EventsContextType | null>(null);

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

function monthKey(year: number, month: number): string {
  return `/api/events?month=${year}-${String(month).padStart(2, "0")}`;
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const { year: initialYear, month: initialMonth } = getNowInDenver();
  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonthState] = useState(initialMonth);
  const [scrollToDate, setScrollToDate] = useState<string | null>(null);

  const { mutate: globalMutate } = useSWRConfig();

  const { data, error: swrError, isLoading, mutate } = useSWR<EventsApiResponse>(
    monthKey(currentYear, currentMonth),
    fetcher,
    {
      keepPreviousData: true,
      refreshInterval: REFRESH_INTERVAL_MS,
      revalidateOnFocus: true,
      revalidateIfStale: true,
    }
  );

  const allEvents = data?.events ?? [];
  const error = swrError ? (swrError instanceof Error ? swrError.message : "Unknown error") : null;
  const lastFetchedAt = data?.fetchedAt ?? null;

  const getEventsForMonth = useCallback(
    (year: number, month: number): CivicEvent[] => {
      return allEvents.filter((event) => {
        const key = getEventDateKeyInDenver(event.startDateTime);
        const [y, m] = key.split("-").map(Number);
        return y === year && m === month;
      });
    },
    [allEvents]
  );

  const setCurrentMonth = useCallback((year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonthState(month);
  }, []);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const updateEvent = useCallback(
    (updatedEvent: CivicEvent) => {
      if (!data) return;
      const updated = {
        ...data,
        events: data.events.map((e) =>
          e.id === updatedEvent.id ? updatedEvent : e
        ),
      };
      mutate(updated, false);
      globalMutate(
        (key: string) =>
          typeof key === "string" && key.startsWith("/api/events?month="),
        undefined,
        { revalidate: false }
      );
    },
    [data, mutate, globalMutate]
  );

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
        updateEvent,
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
