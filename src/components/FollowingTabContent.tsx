"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useFollows } from "@/hooks/useFollows";
import { FollowCategoryButton } from "@/components/FollowCategoryButton";
import { MeetingCard } from "@/components/MeetingCard";
import { useLoginModal } from "@/context/LoginModalContext";
import type { CivicEvent } from "@/lib/types";
import { getCommitteeByCategoryName } from "@/lib/committees";

export function FollowingTabContent() {
  const { status } = useSession();
  const { openLoginModal } = useLoginModal();
  const {
    isAuthenticated,
    favoriteEventIds,
    followedCategoryNames,
    loadingFavorites,
  } = useFollows();

  const [favoriteEvents, setFavoriteEvents] = useState<CivicEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const fetchFollowedEvents = useCallback(() => {
    if (!isAuthenticated || favoriteEventIds.size === 0) {
      setFavoriteEvents([]);
      setEventsError(null);
      return;
    }
    const ids = Array.from(favoriteEventIds);
    setLoadingEvents(true);
    setEventsError(null);
    const params = new URLSearchParams({ eventIds: ids.join(",") });
    fetch(`/api/events?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data: { events?: CivicEvent[] }) => {
        const events = data.events ?? [];
        const byId = new Map(events.map((e) => [e.id, e]));
        setFavoriteEvents(ids.map((id) => byId.get(id)).filter(Boolean) as CivicEvent[]);
      })
      .catch(() => {
        setFavoriteEvents([]);
        setEventsError("Couldn't load followed meetings. Check your connection and try again.");
      })
      .finally(() => setLoadingEvents(false));
  }, [isAuthenticated, favoriteEventIds]);

  useEffect(() => {
    fetchFollowedEvents();
  }, [fetchFollowedEvents]);

  if (status === "loading") {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-24 bg-gray-200 rounded" />
        <div className="h-24 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Following</h2>
        <p className="text-gray-800 mb-6">
          Sign in to see and manage your followed categories and meetings.
        </p>
        <button
          onClick={openLoginModal}
          className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  const categoryNames = Array.from(followedCategoryNames);
  const hasCategories = categoryNames.length > 0;
  const hasFollowedMeetingIds = favoriteEventIds.size > 0;
  const hasFollowedMeetings = favoriteEvents.length > 0;
  const isEmpty = !hasCategories && !hasFollowedMeetings && !loadingEvents && !loadingFavorites;

  return (
    <div>
      <p className="text-gray-600 mb-4">
        Categories and meetings you follow. You&apos;ll get email updates when new meetings are scheduled for followed categories.
      </p>
      <p className="mb-8">
        <Link href="/profile" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          Manage your alerts
        </Link>
      </p>

      {isEmpty && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-600 mb-4">
            You haven&apos;t followed any categories or meetings yet.
          </p>
          <Link
            href="/?tab=governing-body"
            className="inline-flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-700"
          >
            Follow Governing Body
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {hasCategories && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Followed categories</h2>
          <ul className="space-y-3">
            {categoryNames.map((name) => {
              const committee = getCommitteeByCategoryName(name);
              const href = committee ? `/?tab=${committee.slug}` : `/`;
              return (
                <li
                  key={name}
                  className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-lg p-4"
                >
                  <Link href={href} className="font-medium text-gray-900 hover:text-indigo-600">
                    {name}
                  </Link>
                  <FollowCategoryButton
                    categoryName={name}
                    displayName={name}
                    variant="compact"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(hasFollowedMeetingIds || hasFollowedMeetings) && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Followed meetings</h2>
          {loadingEvents ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : eventsError ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-800 mb-3">{eventsError}</p>
              <button
                type="button"
                onClick={fetchFollowedEvents}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {favoriteEvents
                .sort(
                  (a, b) =>
                    new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()
                )
                .map((event) => (
                  <li key={event.id}>
                    <MeetingCard event={event} />
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
