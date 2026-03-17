"use client";

import { ReactNode } from "react";
import { EventsProvider } from "@/context/EventsContext";
import { CommitteeProvider } from "@/context/CommitteeContext";

export function MeetingsProviders({ children }: { children: ReactNode }) {
  return (
    <EventsProvider>
      <CommitteeProvider>{children}</CommitteeProvider>
    </EventsProvider>
  );
}
