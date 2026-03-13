"use client";

import { useEffect, useState } from "react";

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

export function FileMetadata(props: FileMetadataProps) {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const url = props.fileId != null
    ? `/api/file/${props.fileId}/metadata`
    : `/api/attachment/${props.attachmentId}/metadata?agendaId=${props.agendaId}`;

  const cacheKey = props.fileId != null
    ? `file-${props.fileId}`
    : `att-${props.attachmentId}`;

  useEffect(() => {
    let cancelled = false;

    async function fetchMetadata() {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch metadata");
        }
        const data = await response.json();
        if (!cancelled) {
          setMetadata(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching metadata:", err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, url]);

  if (error) {
    return null;
  }

  if (loading) {
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
