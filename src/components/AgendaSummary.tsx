/**
 * "Agenda at a Glance" collapsible panel that shows AI-generated summaries
 * for each agenda item in a meeting. Fetches from /api/meeting/[id]/agenda-summary
 * via SWR and links each item to its anchor on the page for smooth scrolling.
 * Renders nothing on error or when no summaries are available.
 */
"use client";

import { useState } from "react";
import useSWR from "swr";

interface AgendaItemSummary {
  itemId: number;
  outlineNumber: string;
  summary: string;
  detail: string;
}

interface AgendaSummaryResponse {
  summaries: AgendaItemSummary[];
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to fetch agenda summary");
  return res.json() as Promise<AgendaSummaryResponse>;
});

export function AgendaSummary({ eventId }: { eventId: number }) {
  const [open, setOpen] = useState(true);

  const { data, error, isLoading } = useSWR<AgendaSummaryResponse>(
    `/api/meeting/${eventId}/agenda-summary`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
    },
  );

  const summaries = data?.summaries;

  if (error || (!isLoading && (!summaries || summaries.length === 0))) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer"
        >
          <h3 className="text-sm font-semibold text-gray-900">
            Agenda at a Glance
          </h3>
          <span className="text-xs font-medium text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 uppercase tracking-wider">
            AI Summary
          </span>
          <svg
            className={`w-4 h-4 text-gray-900 ml-auto shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="px-4 pb-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {[42, 55, 38, 50, 45].map((w, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-6 h-4 bg-gray-100 rounded shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-gray-100 rounded" style={{ width: `${w}%` }} />
                      <div className="h-3 bg-gray-50 rounded" style={{ width: `${w + 20}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                {summaries!.map((item, i) => (
                  <li key={i}>
                    <a
                      href={`#item-${item.itemId}`}
                      onClick={(e) => {
                        const el = document.getElementById(`item-${item.itemId}`);
                        if (el) {
                          e.preventDefault();
                          el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                      className="flex gap-2.5 -mx-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors group"
                    >
                      <span className="text-gray-900 font-mono text-sm tabular-nums shrink-0 whitespace-nowrap text-right mt-0.5">
                        {item.outlineNumber}
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-gray-900 leading-snug">
                          {item.summary}
                        </p>
                        <p className="text-sm text-gray-800 leading-relaxed mt-0.5">
                          {item.detail}
                        </p>
                      </div>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
