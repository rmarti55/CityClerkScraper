"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useFollows } from "@/hooks/useFollows";
import { useMediaStatus } from "@/hooks/useMediaStatus";
import { FollowCategoryButton } from "@/components/FollowCategoryButton";
import { MeetingCard } from "@/components/MeetingCard";
import { useLoginModal } from "@/context/LoginModalContext";
import type { CivicEvent } from "@/lib/types";
import { getCommitteeByCategoryName } from "@/lib/committees";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load");
    return r.json() as Promise<{ events?: CivicEvent[] }>;
  });

export function FollowingTabContent() {
  const { status } = useSession();
  const { openLoginModal } = useLoginModal();
  const {
    isAuthenticated,
    favoriteEventIds,
    followedCategoryNames,
    loadingFavorites,
  } = useFollows();

  const ids = useMemo(() => Array.from(favoriteEventIds), [favoriteEventIds]);
  const swrKey = isAuthenticated && ids.length > 0
    ? `/api/events?eventIds=${ids.join(",")}`
    : null;

  const { data, error: swrError, isLoading: loadingEvents, mutate } = useSWR(swrKey, fetcher);

  const favoriteEvents = useMemo(() => {
    if (!data?.events) return [];
    const byId = new Map(data.events.map((e) => [e.id, e]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as CivicEvent[];
  }, [data, ids]);

  const eventsError = swrError
    ? "Couldn't load followed meetings. Check your connection and try again."
    : null;

  const mediaStatus = useMediaStatus(favoriteEvents.map((e) => e.id));

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
        Categories and meetings you follow. You&apos;ll get emails for daily meeting digests, new agendas and documents, meeting reminders, and post-meeting transcripts.
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
                onClick={() => mutate()}
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
                    <MeetingCard event={event} media={mediaStatus?.[String(event.id)]} />
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
