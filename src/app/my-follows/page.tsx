"use client";

import { useEffect, useState } from "react";
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

  // Fetch event details for favorited event IDs
  useEffect(() => {
    if (!isAuthenticated || favoriteEventIds.size === 0) {
      setFavoriteEvents([]);
      return;
    }
    const ids = Array.from(favoriteEventIds);
    setLoadingEvents(true);
    fetch("/api/events")
      .then((res) => res.json())
      .then((data: { events?: CivicEvent[] }) => {
        const events = data.events ?? [];
        const byId = new Map(events.map((e) => [e.id, e]));
        setFavoriteEvents(ids.map((id) => byId.get(id)).filter(Boolean) as CivicEvent[]);
      })
      .catch(() => setFavoriteEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [isAuthenticated, favoriteEventIds]);

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
            <h1 className="text-xl font-bold text-gray-900 mb-2">My Follows</h1>
            <p className="text-gray-600 mb-6">
              Sign in to see and manage your followed categories and favorite meetings.
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
  const hasFavorites = favoriteEvents.length > 0;
  const isEmpty = !hasCategories && !hasFavorites && !loadingEvents && !loadingFavorites;

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

        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Follows</h1>
        <p className="text-gray-500 mb-8">
          Categories and meetings you follow. You’ll get email updates when new meetings are scheduled for followed categories.
        </p>

        {isEmpty && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 mb-4">
              You haven’t followed any categories or favorited any meetings yet.
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

        {hasFavorites && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Favorite meetings</h2>
            {loadingEvents ? (
              <div className="text-sm text-gray-500">Loading…</div>
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
