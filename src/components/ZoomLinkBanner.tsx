"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ZoomLinkBanner({ meetingId }: { meetingId: number }) {
  const { data } = useSWR<{ zoomLink: string | null }>(
    `/api/meeting/${meetingId}/zoom-link`,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (!data?.zoomLink) return null;

  return (
    <div className="sm:col-span-2">
      <span className="text-gray-600">Virtual Meeting:</span>{" "}
      <a
        href={data.zoomLink}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-900 underline decoration-gray-300 hover:decoration-gray-500 break-all"
      >
        {data.zoomLink}
      </a>
    </div>
  );
}
