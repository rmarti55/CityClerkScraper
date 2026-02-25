"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useFollows } from "@/hooks/useFollows";
import { FollowCategoryButton } from "@/components/FollowCategoryButton";
import { MeetingCard } from "@/components/MeetingCard";
import { useLoginModal } from "@/context/LoginModalContext";
import type { CivicEvent } from "@/lib/types";

export default function MyFollowsPage() {
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModal();
  const {
    isAuthenticated,
    favoriteEventIds,
    followedCategoryNames,
    loadingFavorites,
    loadingCategories,
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
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-24 bg-gray-200 rounded" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to meetings
          </Link>
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">My Follow</h1>
            <p className="text-gray-600 mb-6">
              Sign in to see and manage your followed categories and meetings you follow.
            </p>
            <button
              onClick={openLoginModal}
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Sign in
            </button>
          </div>
        </div>
      </main>
    );
  }

  const categoryNames = Array.from(followedCategoryNames);
  const hasCategories = categoryNames.length > 0;
  const hasFollowedMeetingIds = favoriteEventIds.size > 0;
  const hasFollowedMeetings = favoriteEvents.length > 0;
  const isEmpty = !hasCategories && !hasFollowedMeetings && !loadingEvents && !loadingFavorites;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to meetings
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Follow</h1>
        <p className="text-gray-500 mb-4">
          Categories and meetings you follow. You’ll get email updates when new meetings are scheduled for followed categories.
        </p>
        <p className="mb-8">
          <Link href="/profile" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Manage your alerts
          </Link>
        </p>

        {isEmpty && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 mb-4">
              You haven’t followed any categories or followed any meetings yet.
            </p>
            <Link
              href="/governing-body"
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
                const slug =
                  name === "Governing Body" ? "governing-body" : name.toLowerCase().replace(/\s+/g, "-");
                const href = slug === "governing-body" ? "/governing-body" : `/`;
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
              <div className="text-sm text-gray-500">Loading…</div>
            ) : eventsError ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">{eventsError}</p>
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
    </main>
  );
}
