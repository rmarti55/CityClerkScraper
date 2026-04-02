"use client";

import { ReactNode, useRef, useEffect } from "react";
import { SWRConfig, type Cache } from "swr";
import { EventsProvider } from "@/context/EventsContext";
import { CommitteeProvider } from "@/context/CommitteeContext";

function usePersistentCache(): () => Cache {
  const cacheRef = useRef<Map<string, unknown>>(new Map());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("swr-cache");
      if (stored) {
        const entries = JSON.parse(stored) as [string, unknown][];
        for (const [key, value] of entries) {
          if (!cacheRef.current.has(key)) {
            cacheRef.current.set(key, value);
          }
        }
      }
    } catch {
      // Corrupt or missing localStorage — start fresh
    }

    const onUnload = () => {
      try {
        const appCache = JSON.stringify(
          Array.from(cacheRef.current.entries())
        );
        localStorage.setItem("swr-cache", appCache);
      } catch {
        // Storage full or unavailable
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const factory = useRef(() => cacheRef.current as Cache);
  return factory.current;
}

export function MeetingsProviders({ children }: { children: ReactNode }) {
  const cacheProvider = usePersistentCache();

  return (
    <SWRConfig
      value={{
        provider: cacheProvider,
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
      }}
    >
      <EventsProvider>
        <CommitteeProvider>
          {children}
        </CommitteeProvider>
      </EventsProvider>
    </SWRConfig>
  );
}
