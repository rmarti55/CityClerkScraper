"use client";

import { ReactNode } from "react";
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

export function MeetingsProviders({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: typeof window !== "undefined" ? localStorageProvider : undefined,
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
