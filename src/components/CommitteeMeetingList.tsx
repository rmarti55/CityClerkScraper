"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CivicEvent } from "@/lib/types";
import { useCommitteeCache } from "@/context/CommitteeContext";
import { MeetingCard } from "./MeetingCard";
import { MeetingListSkeleton } from "./skeletons/MeetingCardSkeleton";

interface CommitteeMeetingListProps {
  categoryName: string;
  committeeSlug: string;
  limit?: number;
  /** Called when the list has finished loading (for scroll restoration) */
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
  limit = 10,
  onLoaded,
}: CommitteeMeetingListProps) {
  const { getCached, setCached } = useCommitteeCache();
  const [meetings, setMeetings] = useState<CivicEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const cached = getCached(committeeSlug, categoryName, limit);
    const isBackgroundRefresh = !!cached;

    if (cached) {
      setMeetings(cached.events);
      setTotal(cached.total);
      setError(null);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setError(null);
    }

    const fetchMeetings = async () => {
      try {
        const params = new URLSearchParams({
          categoryName,
          limit: String(limit),
          page: "1",
        });

        const response = await fetch(`/api/events/by-category?${params}`);

        if (!response.ok) {
          throw new Error("Failed to fetch meetings");
        }

        const data: MeetingsResponse = await response.json();
        setMeetings(data.events);
        setTotal(data.total);
        setCached(committeeSlug, categoryName, limit, {
          events: data.events,
          total: data.total,
        });
      } catch (err) {
        if (!isBackgroundRefresh) {
          setError(
            err instanceof Error ? err.message : "An error occurred"
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();
    // Only re-run when list params change; getCached/setCached are from context
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryName, committeeSlug, limit]);

  // Notify parent when loading has finished (for scroll restoration)
  useEffect(() => {
    if (!isLoading && onLoaded) {
      onLoaded();
    }
  }, [isLoading, onLoaded]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Meetings</h2>
        </div>
        <MeetingListSkeleton count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">Unable to load meetings</span>
        </div>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-500">No meetings found</p>
      </div>
    );
  }

  // Separate upcoming and past meetings
  const now = new Date();
  const upcomingMeetings = meetings.filter(m => new Date(m.startDateTime) >= now);
  const pastMeetings = meetings.filter(m => new Date(m.startDateTime) < now);

  return (
    <div className="space-y-6">
      {/* Upcoming meetings */}
      {upcomingMeetings.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Upcoming
          </h3>
          <div className="space-y-3">
            {upcomingMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} event={meeting} backPath={`/${committeeSlug}`} />
            ))}
          </div>
        </div>
      )}

      {/* Past meetings */}
      {pastMeetings.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Recent Meetings
          </h3>
          <div className="space-y-3">
            {pastMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} event={meeting} backPath={`/${committeeSlug}`} />
            ))}
          </div>
        </div>
      )}

      {/* View all link */}
      {total > limit && (
        <div className="text-center pt-2">
          <Link
            href={`/?category=${committeeSlug}`}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View all {total} meetings →
          </Link>
        </div>
      )}
    </div>
  );
}
