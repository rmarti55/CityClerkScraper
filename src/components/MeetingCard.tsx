"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CivicEvent } from "@/lib/types";
import { formatEventDate, formatEventTime, formatRelativeTime } from "@/lib/utils";
import { EventLocation } from "@/components/EventLocation";
import { useFollows } from "@/hooks/useFollows";
import { useLoginModal } from "@/context/LoginModalContext";
import { useToast } from "@/context/ToastContext";
import { useEvents } from "@/context/EventsContext";
import { MeetingStatusBadges } from "./MeetingStatusBadges";

interface MeetingCardProps {
  event: CivicEvent;
  /** When set, meeting detail page will link "Back" to this path (e.g. "/governing-body") */
  backPath?: string;
  /** Override the default link href (e.g. for search results that encode query params) */
  href?: string;
  /** Custom title node with e.g. search highlighting; falls back to event.eventName */
  titleNode?: React.ReactNode;
  /** Custom location node with e.g. search highlighting; falls back to <EventLocation /> */
  locationNode?: React.ReactNode;
  /** Extra content rendered below the location row (e.g. description snippets) */
  children?: React.ReactNode;
}

export function MeetingCard({
  event: initialEvent,
  backPath,
  href: hrefOverride,
  titleNode,
  locationNode,
  children,
}: MeetingCardProps) {
  const { isAuthenticated, isFavorite, toggleFavorite, loadingFavorites } = useFollows();
  const { openLoginModal } = useLoginModal();
  const { showToast } = useToast();
  const { updateEvent } = useEvents();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [event, setEvent] = useState<CivicEvent>(initialEvent);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const href = hrefOverride
    ? hrefOverride
    : backPath
      ? `/meeting/${event.id}?from=${encodeURIComponent(backPath.replace(/^\//, ""))}`
      : (() => {
          const returnTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
          return `/meeting/${event.id}?from=${encodeURIComponent(returnTo)}`;
        })();

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      openLoginModal();
      showToast("Sign in to follow meetings.");
      return;
    }
    const success = await toggleFavorite(event.id);
    if (success) {
      showToast(favorited ? "Unfollowed." : "Following.");
    }
  };

  const handleRefreshClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/events/${event.id}/refresh`, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const fresh: CivicEvent = data.event;
      setEvent(fresh);
      updateEvent(fresh);
    } catch {
      showToast("Could not refresh — try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const favorited = isFavorite(event.id);

  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all"
    >
      {/* Row 1: Title + action buttons (upper right) */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-gray-900 flex-1 min-w-0">
          {titleNode ?? event.eventName}
        </h3>
        <div className="flex items-center shrink-0">
          {/* Favorite button */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            disabled={loadingFavorites}
            className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-8 h-8 rounded-full transition-colors disabled:opacity-50 ${
              favorited
                ? "text-amber-500"
                : "text-gray-900 hover:bg-gray-100"
            }`}
            aria-label={favorited ? "Unfollow meeting" : "Follow meeting"}
            title={favorited ? "Unfollow meeting" : "Follow meeting (sign in to sync)"}
          >
            {favorited ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Row 2: Date/time + attachments/status badges (inline, right-aligned) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 min-w-0">
          <svg className="w-4 h-4 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="truncate">
            {formatEventDate(event.startDateTime)} at{" "}
            {formatEventTime(event.startDateTime)}
          </span>
        </div>
        <MeetingStatusBadges
          event={event}
          fileCount={event.fileCount ?? 0}
          variant="card"
          className="flex items-center gap-2 shrink-0"
        />
      </div>

      {/* Row 3: Location */}
      {locationNode !== undefined ? locationNode : (
        <EventLocation 
          event={event} 
          truncate 
          format="short" 
          className="mt-2" 
          iconClassName="w-4 h-4 text-indigo-400 shrink-0 mt-0.5"
          linkable={false}
        />
      )}

      {/* Optional extra content (e.g. search description snippets) */}
      {children}

      {/* Row 4: Last synced timestamp + Refresh */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {event.cachedAt ? (
          <p className="text-xs text-gray-500">
            {isRefreshing ? "Syncing…" : `Synced ${formatRelativeTime(event.cachedAt)}`}
          </p>
        ) : (
          <div /> // Spacer if no cachedAt
        )}
        
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-800 transition-colors disabled:opacity-40"
          aria-label="Refresh meeting data"
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
    </Link>
  );
}
