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
      <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-lg">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 p-5 text-left cursor-pointer"
        >
          <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="text-sm font-semibold text-indigo-900">
            Agenda at a Glance
          </h3>
          <span className="text-[10px] font-medium text-indigo-400 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 uppercase tracking-wider">
            AI Summary
          </span>
          <svg
            className={`w-4 h-4 text-indigo-400 ml-auto shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="px-5 pb-5">
            {isLoading ? (
              <div className="space-y-3">
                {[42, 55, 38, 50, 45].map((w, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-6 h-4 bg-indigo-100 rounded shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-indigo-100 rounded" style={{ width: `${w}%` }} />
                      <div className="h-3 bg-indigo-50 rounded" style={{ width: `${w + 20}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ol className="space-y-1">
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
                      className="flex gap-2.5 -mx-2 px-2 py-1.5 rounded-md hover:bg-indigo-100/50 transition-colors group"
                    >
                      <span className="text-indigo-400 font-mono text-xs tabular-nums shrink-0 w-10 text-right mt-0.5">
                        {item.outlineNumber}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-snug group-hover:text-indigo-700 transition-colors">
                          {item.summary}
                        </p>
                        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
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
