"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEvents } from "@/context/EventsContext";
import { formatRelativeTime } from "@/lib/utils";
import type { CivicEvent } from "@/lib/types";

interface MeetingRefreshButtonProps {
  eventId: number;
  cachedAt: string | undefined;
}

export function MeetingRefreshButton({ eventId, cachedAt: initialCachedAt }: MeetingRefreshButtonProps) {
  const router = useRouter();
  const { updateEvent } = useEvents();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachedAt, setCachedAt] = useState(initialCachedAt);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/refresh`, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const fresh: CivicEvent = data.event;
      setCachedAt(fresh.cachedAt);
      updateEvent(fresh);
      // Reload the server component so file list reflects any new attachments
      router.refresh();
    } catch {
      setError("Could not sync — try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      {cachedAt && !isRefreshing && (
        <span>Last synced {formatRelativeTime(cachedAt)}</span>
      )}
      {isRefreshing && <span>Syncing…</span>}
      {error && <span className="text-red-600 text-xs">{error}</span>}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
        title="Sync latest data from CivicClerk"
      >
        <svg
          className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Refresh
      </button>
    </div>
  );
}
