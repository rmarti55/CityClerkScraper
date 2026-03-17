"use client";

import useSWR from "swr";

type FileMetadataProps =
  | { fileId: number; attachmentId?: undefined; agendaId?: undefined }
  | { fileId?: undefined; attachmentId: number; agendaId: number };

interface Metadata {
  size: number;
  pageCount: number | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="w-1 h-1 bg-gray-300 rounded-full animate-pulse" />
      <span className="w-1 h-1 bg-gray-300 rounded-full animate-pulse [animation-delay:150ms]" />
      <span className="w-1 h-1 bg-gray-300 rounded-full animate-pulse [animation-delay:300ms]" />
    </span>
  );
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to fetch metadata");
  return res.json() as Promise<Metadata>;
});

export function FileMetadata(props: FileMetadataProps) {
  const url = props.fileId != null
    ? `/api/file/${props.fileId}/metadata`
    : `/api/attachment/${props.attachmentId}/metadata?agendaId=${props.agendaId}`;

  const { data: metadata, error, isLoading } = useSWR<Metadata>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
  });

  if (error) {
    return null;
  }

  if (isLoading) {
    return (
      <span className="text-xs text-gray-400 inline-flex items-center gap-1">
        <LoadingDots />
      </span>
    );
  }

  if (!metadata) {
    return null;
  }

  return (
    <span className="text-xs text-gray-400 inline-flex items-center gap-2">
      <span>{formatFileSize(metadata.size)}</span>
      {metadata.pageCount !== null && (
        <>
          <span className="text-gray-300">•</span>
          <span>{metadata.pageCount} {metadata.pageCount === 1 ? "page" : "pages"}</span>
        </>
      )}
    </span>
  );
}
