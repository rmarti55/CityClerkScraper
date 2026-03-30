/**
 * Meeting recording and transcript panel.
 *
 * Fetches transcript data from /api/meeting/[id]/transcript via SWR.
 * When a linked YouTube video exists, renders an embedded player and
 * (if AI processing is complete) tabbed content: executive summary with
 * key decisions/motions/action items, searchable full transcript, and
 * speaker-attributed segments with color-coded badges.
 *
 * Handles processing states: pending, processing, failed, and completed.
 * Renders nothing when no video is linked to the meeting.
 */
"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";

interface TranscriptSummary {
  executiveSummary: string;
  keyDecisions: string[];
  actionItems: string[];
  publicCommentsSummary: string;
  motionsAndVotes: string[];
}

interface SpeakerSegment {
  speaker: string;
  startOffset: number;
  endOffset: number;
  text: string;
}

interface TopicTag {
  topic: string;
  keywords: string[];
  relevanceScore: number;
}

interface TranscriptData {
  hasTranscript: boolean;
  video?: {
    id: number;
    youtubeVideoId: string;
    title: string;
    thumbnailUrl: string;
    duration: string;
    source: string;
    matchConfidence: number;
  };
  transcript?: {
    id: number;
    status: string;
    cleanedTranscript: string | null;
    summary: TranscriptSummary | null;
    speakers: SpeakerSegment[] | null;
    topics: TopicTag[] | null;
    model: string | null;
    generatedAt: string | null;
    errorMessage: string | null;
  } | null;
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch transcript");
    return res.json() as Promise<TranscriptData>;
  });

const SPEAKER_COLORS = [
  "bg-blue-50 border-blue-200 text-blue-800",
  "bg-green-50 border-green-200 text-green-800",
  "bg-purple-50 border-purple-200 text-purple-800",
  "bg-amber-50 border-amber-200 text-amber-800",
  "bg-rose-50 border-rose-200 text-rose-800",
  "bg-cyan-50 border-cyan-200 text-cyan-800",
  "bg-indigo-50 border-indigo-200 text-indigo-800",
  "bg-orange-50 border-orange-200 text-orange-800",
];

export function MeetingTranscript({ eventId }: { eventId: number }) {
  const [activeTab, setActiveTab] = useState<"summary" | "transcript" | "speakers">("summary");
  const [showVideo, setShowVideo] = useState(true);
  const [cardOpen, setCardOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<TranscriptData>(
    `/api/meeting/${eventId}/transcript`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
      refreshInterval: (latestData: TranscriptData | undefined) => {
        const status = latestData?.transcript?.status;
        return status === "pending" || status === "processing" ? 30_000 : 0;
      },
    },
  );

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/meeting/${eventId}/transcript`, { method: "POST" });
      if (!res.ok) throw new Error("Retry failed");
      await mutate();
    } catch {
      // mutate to refresh status even on failure
      await mutate();
    } finally {
      setIsRetrying(false);
    }
  };

  const speakerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (data?.transcript?.speakers) {
      const uniqueSpeakers = [...new Set(data.transcript.speakers.map((s) => s.speaker))];
      uniqueSpeakers.forEach((speaker, i) => {
        map.set(speaker, SPEAKER_COLORS[i % SPEAKER_COLORS.length]);
      });
    }
    return map;
  }, [data?.transcript?.speakers]);

  if (isLoading) return <TranscriptSkeleton />;
  if (error || !data?.hasTranscript) return null;

  const { video, transcript } = data;
  if (!video) return null;

  const isProcessing = transcript?.status === "processing" || transcript?.status === "extracting";
  const isPending = transcript?.status === "pending";
  const isFailed = transcript?.status === "failed";
  const isCompleted = transcript?.status === "completed";

  return (
    <div className="mb-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Header — clickable to collapse/expand the card */}
        <button
          type="button"
          onClick={() => setCardOpen(!cardOpen)}
          className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-100 text-left cursor-pointer"
        >
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-900">Meeting Recording & Transcript</h3>
          <span className="text-xs font-medium text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 uppercase tracking-wider">
            AI Transcript
          </span>
          <svg
            className={`w-4 h-4 text-gray-900 ml-auto shrink-0 transition-transform duration-200 ${cardOpen ? "rotate-0" : "-rotate-90"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {cardOpen && (
        <>
        {/* Video toggle */}
        {video.youtubeVideoId && (
          <div className="flex justify-end px-4 py-1.5 border-b border-gray-100">
            <button
              type="button"
              onClick={() => setShowVideo(!showVideo)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              {showVideo ? "Hide Video" : "Watch Video"}
            </button>
          </div>
        )}

        {/* YouTube Embed */}
        {showVideo && video.youtubeVideoId && (
          <div className="bg-black px-8 sm:px-16 lg:px-24 py-4">
            <div className="aspect-video max-w-4xl mx-auto">
              <iframe
                src={`https://www.youtube.com/embed/${video.youtubeVideoId}`}
                title={video.title || "Meeting Video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* Status messages */}
        {(isProcessing || isPending) && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {isPending ? "Transcript queued for processing..." : "AI is processing the transcript..."}
            </div>
          </div>
        )}

        {isFailed && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-100">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-red-700">
                Transcript processing failed{transcript?.errorMessage ? `: ${transcript.errorMessage}` : ""}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md cursor-pointer transition-colors"
              >
                {isRetrying ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Retrying...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        {isCompleted && transcript && (
          <>
            <div className="flex border-b border-gray-200">
              {(["summary", "transcript", "speakers"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium capitalize cursor-pointer transition-colors ${
                    activeTab === tab
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === "summary" && transcript.summary && (
                <SummaryTab summary={transcript.summary} topics={transcript.topics} />
              )}
              {activeTab === "transcript" && (
                <TranscriptTab
                  text={transcript.cleanedTranscript || ""}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              )}
              {activeTab === "speakers" && transcript.speakers && (
                <SpeakersTab speakers={transcript.speakers} colorMap={speakerColorMap} />
              )}
            </div>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
      >
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

/** Structured summary: executive overview, topics, key decisions, motions, action items, public comments. */
function SummaryTab({ summary, topics }: { summary: TranscriptSummary; topics: TopicTag[] | null }) {
  return (
    <div className="max-h-[32rem] overflow-y-auto space-y-2">
      <CollapsibleSection title="Executive Summary">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary.executiveSummary}</p>
      </CollapsibleSection>

      {topics && topics.length > 0 && (
        <CollapsibleSection title="Topics Discussed">
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full"
                title={`Keywords: ${topic.keywords.join(", ")}`}
              >
                {topic.topic}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {summary.keyDecisions.length > 0 && (
        <CollapsibleSection title="Key Decisions">
          <ul className="space-y-1">
            {summary.keyDecisions.map((decision, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5 shrink-0">&#10003;</span>
                {decision}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {summary.motionsAndVotes.length > 0 && (
        <CollapsibleSection title="Motions & Votes">
          <ul className="space-y-1">
            {summary.motionsAndVotes.map((motion, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-blue-500 mt-0.5 shrink-0">&#9679;</span>
                {motion}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {summary.actionItems.length > 0 && (
        <CollapsibleSection title="Action Items">
          <ul className="space-y-1">
            {summary.actionItems.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-amber-500 mt-0.5 shrink-0">&#9656;</span>
                {item}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {summary.publicCommentsSummary && (
        <CollapsibleSection title="Public Comments">
          <p className="text-sm text-gray-700 leading-relaxed">{summary.publicCommentsSummary}</p>
        </CollapsibleSection>
      )}
    </div>
  );
}

/** Full transcript text with inline search and match highlighting. */
function TranscriptTab({
  text,
  searchQuery,
  onSearchChange,
}: {
  text: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const highlightedText = useMemo(() => {
    if (!searchQuery.trim() || !text) return null;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.split(regex);
  }, [text, searchQuery]);

  const matchCount = useMemo(() => {
    if (!searchQuery.trim() || !text) return 0;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    return (text.match(regex) || []).length;
  }, [text, searchQuery]);

  return (
    <div>
      {/* Search bar */}
      <div className="mb-3 relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search transcript..."
          className="w-full px-3 py-2 pl-9 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {matchCount > 0 && (
          <span className="absolute right-3 top-2.5 text-xs text-gray-400">
            {matchCount} match{matchCount !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      {/* Transcript text */}
      <div className="max-h-96 overflow-y-auto text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {highlightedText ? (
          highlightedText.map((part, i) =>
            i % 2 === 1 ? (
              <mark key={i} className="bg-yellow-200 rounded px-0.5">
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            ),
          )
        ) : (
          text || <span className="text-gray-400 italic">No transcript text available</span>
        )}
      </div>
    </div>
  );
}

/** Color-coded speaker segments with filter-by-speaker toggle. */
function SpeakersTab({
  speakers,
  colorMap,
}: {
  speakers: SpeakerSegment[];
  colorMap: Map<string, string>;
}) {
  const [expandedSpeaker, setExpandedSpeaker] = useState<string | null>(null);

  const speakerGroups = useMemo(() => {
    const groups = new Map<string, { count: number; totalLength: number }>();
    for (const seg of speakers) {
      const existing = groups.get(seg.speaker) || { count: 0, totalLength: 0 };
      existing.count++;
      existing.totalLength += seg.text.length;
      groups.set(seg.speaker, existing);
    }
    return [...groups.entries()].sort((a, b) => b[1].totalLength - a[1].totalLength);
  }, [speakers]);

  return (
    <div className="space-y-3">
      {/* Speaker overview */}
      <div className="flex flex-wrap gap-2">
        {speakerGroups.map(([speaker, stats]) => (
          <button
            key={speaker}
            type="button"
            onClick={() => setExpandedSpeaker(expandedSpeaker === speaker ? null : speaker)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border cursor-pointer transition-colors ${
              colorMap.get(speaker) || "bg-gray-50 border-gray-200 text-gray-700"
            } ${expandedSpeaker === speaker ? "ring-2 ring-blue-300" : ""}`}
          >
            {speaker}
            <span className="opacity-60">({stats.count})</span>
          </button>
        ))}
      </div>

      {/* Speaker segments */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {speakers
          .filter((s) => !expandedSpeaker || s.speaker === expandedSpeaker)
          .map((seg, i) => (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 ${
                colorMap.get(seg.speaker) || "bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              <p className="text-xs font-semibold mb-1">{seg.speaker}</p>
              <p className="text-sm leading-relaxed">{seg.text}</p>
            </div>
          ))}
      </div>
    </div>
  );
}

function TranscriptSkeleton() {
  return (
    <div className="mb-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-48" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
        </div>
      </div>
    </div>
  );
}
