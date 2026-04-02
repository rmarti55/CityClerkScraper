"use client";

import { useState } from "react";
import { useLiveStream } from "@/hooks/useLiveStream";
import { YouTubeIcon } from "./icons";

interface LiveStreamEmbedProps {
  eventId: number;
  startDateTime: string;
}

/**
 * Embeds the YouTube live stream when the meeting is currently being broadcast.
 * Self-manages visibility: renders nothing when the channel isn't live or the
 * live stream doesn't match this event. Polls every 60s via useLiveStream.
 */
export function LiveStreamEmbed({ eventId, startDateTime }: LiveStreamEmbedProps) {
  const { isLive, videoId, title } = useLiveStream(eventId, startDateTime);
  const [collapsed, setCollapsed] = useState(false);

  if (!isLive || !videoId) return null;

  return (
    <div id="live-stream" className="mb-6">
      <div className="bg-white border-2 border-red-300 rounded-lg overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white text-left cursor-pointer"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
          </span>
          <YouTubeIcon className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold">LIVE</h3>
            <p className="text-xs text-red-100 truncate">
              {title || "Watching on YouTube"}
            </p>
          </div>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-red-100 hover:text-white underline decoration-red-300 hover:decoration-white shrink-0 transition-colors"
          >
            Open on YouTube
          </a>
          <svg
            className={`w-4 h-4 text-white ml-1 shrink-0 transition-transform duration-200 ${collapsed ? "-rotate-90" : "rotate-0"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {!collapsed && (
          <div className="bg-black px-4 sm:px-8 lg:px-16 py-4">
            <div className="aspect-video max-w-4xl mx-auto">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                title={title || "Live Meeting Stream"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
