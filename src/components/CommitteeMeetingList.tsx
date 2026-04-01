"use client";

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import useSWR from "swr";
import { CivicEvent } from "@/lib/types";
import { getMeetingTimeStatus } from "@/lib/datetime";
import { useMediaStatus } from "@/hooks/useMediaStatus";
import { useCommitteeCache } from "@/context/CommitteeContext";
import { MeetingCard } from "./MeetingCard";
import { MeetingListSkeleton } from "./skeletons/MeetingCardSkeleton";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch meetings");
    return r.json() as Promise<MeetingsResponse>;
  });

const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

interface CommitteeMeetingListProps {
  categoryName: string;
  committeeSlug: string;
  limit?: number;
  onLoaded?: () => void;
}

interface MeetingsResponse {
  events: CivicEvent[];
  total: number;
  page: number;
  totalPages: number;
}

export function CommitteeMeetingList({
  categoryName,
  committeeSlug,
  limit = 15,
  onLoaded,
}: CommitteeMeetingListProps) {
  const hydrated = useHydrated();
  const { getCached, setCached, setLastClicked, getLastClicked } = useCommitteeCache();
  const page1Key = `/api/events/by-committee?categoryName=${encodeURIComponent(categoryName)}&limit=${limit}&page=1`;

  const { data, error: swrError, isLoading } = useSWR<MeetingsResponse>(
    page1Key,
    fetcher,
    { keepPreviousData: true }
  );

  const restoredRef = useRef(false);
  const initialCache = useRef(getCached(committeeSlug, categoryName, limit));
  const scrollTargetId = useRef(getLastClicked(committeeSlug));

  const [extraMeetings, setExtraMeetings] = useState<CivicEvent[]>(
    () => initialCache.current?.extraEvents ?? []
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(
    () => initialCache.current?.currentPage ?? 1
  );
  const [knownTotal, setKnownTotal] = useState(
    () => initialCache.current?.total ?? 0
  );

  if (initialCache.current && !restoredRef.current) {
    restoredRef.current = true;
  }

  const meetings = data
    ? [...data.events, ...extraMeetings.filter((e) => !data.events.some((d) => d.id === e.id))]
    : [];
  const total = knownTotal || data?.total || 0;
  const error = swrError ? (swrError instanceof Error ? swrError.message : "An error occurred") : loadMoreError;

  const mediaStatus = useMediaStatus(meetings.map((e) => e.id));

  const prevDataRef = useRef(data);
  useEffect(() => {
    if (data) {
      setKnownTotal(data.total);
      if (restoredRef.current && prevDataRef.current === undefined) {
        restoredRef.current = false;
        prevDataRef.current = data;
        return;
      }
      if (prevDataRef.current !== data) {
        prevDataRef.current = data;
      }
    }
  }, [data]);

  useEffect(() => {
    if (!isLoading && onLoaded) {
      onLoaded();
    }
  }, [isLoading, onLoaded]);

  useEffect(() => {
    const targetId = scrollTargetId.current;
    if (targetId === null || !data) return;
    scrollTargetId.current = null;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-meeting-id="${targetId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "center" });
      }
    });
  }, [data]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;

    const nextPage = currentPage + 1;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const params = new URLSearchParams({
        categoryName,
        limit: String(limit),
        page: String(nextPage),
      });

      const response = await fetch(`/api/events/by-committee?${params}`);
      if (!response.ok) throw new Error("Failed to load more meetings");

      const result: MeetingsResponse = await response.json();
      const newExtra = [...extraMeetings, ...result.events];
      setExtraMeetings(newExtra);
      setKnownTotal(result.total);
      setCurrentPage(nextPage);
      setCached(committeeSlug, categoryName, limit, {
        extraEvents: newExtra,
        total: result.total,
        currentPage: nextPage,
      });
    } catch (err) {
      setLoadMoreError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, currentPage, categoryName, limit, extraMeetings, committeeSlug, setCached]);

  const hasMore = meetings.length < total;

  if (isLoading || !hydrated) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Meetings</h2>
        </div>
        <MeetingListSkeleton count={5} />
      </div>
    );
  }

  if (error && meetings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">Unable to load meetings</span>
        </div>
        <p className="text-sm text-gray-800">{error}</p>
      </div>
    );
  }

  if (meetings.length === 0) {
    return <MeetingListSkeleton count={5} />;
  }

  const upcomingMeetings = meetings.filter(m => {
    const s = getMeetingTimeStatus(m.startDateTime);
    return s === "happening-now" || s === "today" || s === "upcoming";
  });
  const pastMeetings = meetings.filter(m => getMeetingTimeStatus(m.startDateTime) === "past");

  return (
    <div className="space-y-6">
      {upcomingMeetings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Upcoming
          </h3>
          <div className="space-y-3">
            {upcomingMeetings.map((meeting) => (
              <div key={meeting.id} data-meeting-id={meeting.id} onClick={() => setLastClicked(committeeSlug, meeting.id)}>
                <MeetingCard event={meeting} backPath={`/?tab=${committeeSlug}`} media={mediaStatus?.[String(meeting.id)]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {pastMeetings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Past Meetings
          </h3>
          <div className="space-y-3">
            {pastMeetings.map((meeting) => (
              <div key={meeting.id} data-meeting-id={meeting.id} onClick={() => setLastClicked(committeeSlug, meeting.id)}>
                <MeetingCard event={meeting} backPath={`/?tab=${committeeSlug}`} media={mediaStatus?.[String(meeting.id)]} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center pt-2 space-y-2">
        <p className="text-xs text-gray-500">
          Showing {meetings.length} of {total} meetings
        </p>

        {error && meetings.length > 0 && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </>
            ) : (
              <>Load more meetings</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
