"use client";

import { useEffect, useRef } from "react";
import { CivicEvent } from "@/lib/types";
import { MeetingCard } from "./MeetingCard";
import { getEventDateKeyInDenver } from "@/lib/datetime";

interface MeetingListProps {
  events: CivicEvent[];
  scrollToDate?: string | null;
  onScrollComplete?: () => void;
}

// Group events by date (America/Denver) so section headers match the date on cards
function groupEventsByDate(events: CivicEvent[]): Map<string, CivicEvent[]> {
  const groups = new Map<string, CivicEvent[]>();

  for (const event of events) {
    const dateKey = getEventDateKeyInDenver(event.startDateTime);
    const existing = groups.get(dateKey) || [];
    groups.set(dateKey, [...existing, event]);
  }

  return groups;
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function MeetingList({ events, scrollToDate, onScrollComplete }: MeetingListProps) {
  const highlightedRef = useRef<string | null>(null);

  // Scroll to target date when scrollToDate changes. Defer so it runs after layout and wins on desktop.
  useEffect(() => {
    if (!scrollToDate || events.length === 0) return;

    const availableDates = Array.from(
      new Set(events.map((e) => getEventDateKeyInDenver(e.startDateTime)))
    ).sort();

    let targetDate = availableDates.find((d) => d >= scrollToDate);
    if (!targetDate) {
      targetDate = availableDates[availableDates.length - 1];
    }

    const dateKey = targetDate;
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const element = document.getElementById(`date-${dateKey}`);
        if (element) {
          const yOffset = -100;
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: "auto" });

          highlightedRef.current = dateKey;
          element.classList.add("scroll-highlight");

          setTimeout(() => {
            element.classList.remove("scroll-highlight");
            highlightedRef.current = null;
            onScrollComplete?.();
          }, 2000);
        }
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [scrollToDate, events, onScrollComplete]);

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 text-gray-300 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-gray-500">No meetings scheduled this month</p>
      </div>
    );
  }

  const groupedEvents = groupEventsByDate(events);
  const sortedDates = Array.from(groupedEvents.keys()).sort();

  // Calculate stats
  const totalFiles = events.reduce((sum, e) => sum + (e.fileCount || 0), 0);
  const withFiles = events.filter((e) => (e.fileCount || 0) > 0).length;

  return (
    <div>
      {/* Stats bar - wraps on mobile, inline on desktop */}
      <div className="flex flex-wrap justify-center sm:justify-between items-center gap-x-4 gap-y-1 mb-6 text-sm text-gray-500">
        <span className="whitespace-nowrap">{events.length} meetings</span>
        <span className="whitespace-nowrap">{withFiles} with attachments</span>
        <span className="whitespace-nowrap">{totalFiles} total files</span>
      </div>

      {/* Grouped meetings */}
      <div className="space-y-8">
        {sortedDates.map((dateKey) => (
          <div key={dateKey} id={`date-${dateKey}`}>
            <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
              {formatDateHeader(dateKey)}
            </h2>
            <div className="space-y-3">
              {groupedEvents.get(dateKey)!.map((event) => (
                <MeetingCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
