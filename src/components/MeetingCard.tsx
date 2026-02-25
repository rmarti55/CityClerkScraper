"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CivicEvent } from "@/lib/types";
import { formatEventDate, formatEventTime } from "@/lib/utils";
import { useFollows } from "@/hooks/useFollows";
import { useLoginModal } from "@/context/LoginModalContext";
import { useToast } from "@/context/ToastContext";
import { MeetingStatusBadges } from "./MeetingStatusBadges";

interface MeetingCardProps {
  event: CivicEvent;
  /** When set, meeting detail page will link "Back" to this path (e.g. "/governing-body") */
  backPath?: string;
}

export function MeetingCard({ event, backPath }: MeetingCardProps) {
  const { isAuthenticated, isFavorite, toggleFavorite, loadingFavorites } = useFollows();
  const { openLoginModal } = useLoginModal();
  const { showToast } = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const href = backPath
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
      showToast("Sign in to save favorites.");
      return;
    }
    const success = await toggleFavorite(event.id);
    if (success) {
      showToast(favorited ? "Removed from favorites." : "Saved to favorites.");
    }
  };

  const favorited = isFavorite(event.id);

  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-gray-900">
            {event.eventName}
          </h3>

          {/* Date and time */}
          <p className="text-sm text-gray-500 mt-1">
            {formatEventDate(event.startDateTime)} at{" "}
            {formatEventTime(event.startDateTime)}
          </p>

          {/* Location */}
          {event.venueName && (
            <p className="text-sm text-gray-400 mt-1 truncate">
              {event.venueName}
            </p>
          )}
        </div>

        {/* Status badges + favorite */}
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {/* Favorite star */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            disabled={loadingFavorites}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors disabled:opacity-50 ${
              favorited
                ? "text-amber-500"
                : "text-gray-400 hover:bg-gray-100"
            }`}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            title={favorited ? "Remove from favorites" : "Save to favorites (sign in to sync)"}
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

          <MeetingStatusBadges
            event={event}
            fileCount={event.fileCount ?? 0}
            variant="card"
            className="sm:flex-col sm:items-end"
          />
        </div>
      </div>
    </Link>
  );
}
