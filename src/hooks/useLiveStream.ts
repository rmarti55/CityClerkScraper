import useSWR from "swr";
import { isEventHappeningNow, isEventToday } from "@/lib/datetime";
import type { LiveStreamResult } from "@/lib/youtube/live";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<LiveStreamResult>);

/**
 * Polls /api/youtube/live every 60s, but only when the meeting
 * is "happening now" or "today" (before start). Skips entirely
 * for past/future meetings to avoid wasting YouTube API quota.
 */
export function useLiveStream(eventId: number, startDateTime: string) {
  const shouldPoll =
    isEventHappeningNow(startDateTime) || isEventToday(startDateTime);

  const { data, error, isLoading } = useSWR<LiveStreamResult>(
    shouldPoll ? "/api/youtube/live" : null,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    },
  );

  const isLiveForThisEvent =
    data?.isLive === true && data?.eventId === eventId;

  return {
    isLive: isLiveForThisEvent,
    videoId: isLiveForThisEvent ? data?.videoId : undefined,
    title: isLiveForThisEvent ? data?.title : undefined,
    thumbnailUrl: isLiveForThisEvent ? data?.thumbnailUrl : undefined,
    isLoading,
    error,
  };
}
