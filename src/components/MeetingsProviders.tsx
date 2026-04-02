"use client";

import { ReactNode, useSyncExternalStore } from "react";
import { SWRConfig, type Cache } from "swr";
import { EventsProvider } from "@/context/EventsContext";
import { CommitteeProvider } from "@/context/CommitteeContext";

function localStorageProvider(): Cache {
  const map = new Map(
    JSON.parse(localStorage.getItem("swr-cache") || "[]")
  );
  window.addEventListener("beforeunload", () => {
    const appCache = JSON.stringify(Array.from(map.entries()));
    localStorage.setItem("swr-cache", appCache);
  });
  return map as Cache;
}

const emptySubscribe = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function MeetingsProviders({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();

  return (
    <SWRConfig
      value={{
        provider: hydrated ? localStorageProvider : undefined,
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
      }}
      key={hydrated ? "hydrated" : "ssr"}
    >
      <EventsProvider>
        <CommitteeProvider>
          {children}
        </CommitteeProvider>
      </EventsProvider>
    </SWRConfig>
  );
}
