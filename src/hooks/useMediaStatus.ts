import useSWR from "swr";
import type { MediaStatusMap } from "@/app/api/meetings/media-status/route";

const mediaFetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<MediaStatusMap>);

export function useMediaStatus(eventIds: number[]) {
  const key = eventIds.length
    ? `/api/meetings/media-status?ids=${eventIds.join(",")}`
    : null;

  const { data } = useSWR<MediaStatusMap>(key, mediaFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  return data;
}
