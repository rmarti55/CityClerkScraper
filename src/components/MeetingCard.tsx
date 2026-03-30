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
import { MeetingStatusBadges, type MediaFlags } from "./MeetingStatusBadges";
import { StarFilledIcon, StarOutlineIcon, CalendarIcon, RefreshIcon } from "./icons";

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
  /** Media availability flags (video, transcript, zoom) for badge icons. */
  media?: MediaFlags;
}

export function MeetingCard({
  event: initialEvent,
  backPath,
  href: hrefOverride,
  titleNode,
  locationNode,
  children,
  media,
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
              <StarFilledIcon className="w-5 h-5" />
            ) : (
              <StarOutlineIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Row 2: Date/time + attachments/status badges (inline, right-aligned) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 min-w-0">
          <CalendarIcon className="w-4 h-4 text-gray-900 shrink-0" />
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
          media={media}
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
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-900 hover:bg-gray-100 rounded px-1 -mx-1 transition-colors disabled:opacity-40"
          aria-label="Refresh meeting data"
          title="Sync latest data from CivicClerk"
        >
          <RefreshIcon className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </Link>
  );
}
