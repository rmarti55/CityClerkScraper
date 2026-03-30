"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEvents } from "@/context/EventsContext";
import { formatRelativeTime } from "@/lib/utils";
import type { CivicEvent } from "@/lib/types";
import { RefreshIcon } from "./icons";

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
    <div className="flex items-center gap-2 text-sm text-gray-600">
      {cachedAt && !isRefreshing && (
        <span>Last synced {formatRelativeTime(cachedAt)}</span>
      )}
      {isRefreshing && <span>Syncing…</span>}
      {error && <span className="text-red-600 text-xs">{error}</span>}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-800 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
        title="Sync latest data from CivicClerk"
      >
        <RefreshIcon className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </div>
  );
}
