"use client";

import { useState } from "react";
import { parseAgendaItem, type ParsedAgendaItem, type CommitteeDate, type Sponsor } from "@/lib/agenda-item-parser";
import type { MeetingItem } from "@/lib/types";
import type { AgendaItemSummary } from "@/lib/llm/agenda-summary";
import { PersonLink } from "./PersonLink";

function SponsorList({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
      {sponsors.map((s, i) => (
        <span key={i} className="text-xs text-gray-500 inline-flex items-center gap-1">
          <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <PersonLink name={s.name} email={s.email}>
            <span>
              {s.name}
              {s.title && <span className="text-gray-400">, {s.title}</span>}
            </span>
          </PersonLink>
          {s.email && (
            <a
              href={`mailto:${s.email}`}
              className="text-indigo-600 hover:text-indigo-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {s.email}
            </a>
          )}
        </span>
      ))}
    </div>
  );
}

function CommitteeReviewList({ dates }: { dates: CommitteeDate[] }) {
  if (dates.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        Committee Review
      </h4>
      <ul className="space-y-0.5">
        {dates.map((cd, i) => {
          const isCanceled = cd.note?.toUpperCase().includes("CANCELED");
          return (
            <li key={i} className="flex items-baseline gap-2 text-xs">
              <span className={isCanceled ? "text-gray-400 line-through" : "text-gray-700"}>
                {cd.committee}
                {cd.note && (
                  <span className={isCanceled ? "text-red-600 ml-1" : "text-gray-400 ml-1"}>
                    ({cd.note})
                  </span>
                )}
              </span>
              <span className={`tabular-nums whitespace-nowrap ${isCanceled ? "text-gray-400 line-through" : "text-gray-500"}`}>
                {cd.date}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DescriptionBlock({ description }: { description: string }) {
  const isLong = description.length > 300;
  const [expanded, setExpanded] = useState(false);

  const displayText = isLong && !expanded ? description.slice(0, 280) + "..." : description;

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line break-words">
        {displayText}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-indigo-600 hover:text-indigo-700 mt-1 font-medium"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function FullTextDisclosure({ parsed }: { parsed: ParsedAgendaItem }) {
  const [open, setOpen] = useState(false);
  const fullText = [parsed.title, parsed.description].filter(Boolean).join("\n\n");
  if (!fullText) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium"
      >
        <svg
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Full Text
      </button>
      {open && (
        <div className="mt-1.5 pl-4 border-l-2 border-gray-200">
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line break-words">
            {fullText}
          </p>
        </div>
      )}
    </div>
  );
}

interface AgendaItemContentProps {
  item: MeetingItem;
  summary?: AgendaItemSummary;
}

export function AgendaItemContent({ item, summary }: AgendaItemContentProps) {
  const parsed: ParsedAgendaItem = parseAgendaItem(
    item.agendaObjectItemName,
    item.agendaObjectItemOutlineNumber,
    item.agendaObjectItemDescription,
  );

  if (summary) {
    return (
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 leading-snug break-words">
            {parsed.outlineNumber} {summary.summary}
          </p>
          <span className="text-[9px] font-medium text-indigo-400 bg-indigo-50 border border-indigo-200 rounded px-1 py-px uppercase tracking-wider shrink-0 leading-none">
            AI
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
          {summary.detail}
        </p>
        <FullTextDisclosure parsed={parsed} />
        <SponsorList sponsors={parsed.sponsors} />
        <CommitteeReviewList dates={parsed.committeeReview} />
      </div>
    );
  }

  const titleText = [parsed.outlineNumber, parsed.title].filter(Boolean).join(" ");

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-900 leading-snug break-words">
        {titleText}
      </p>
      {parsed.description && <DescriptionBlock description={parsed.description} />}
      <SponsorList sponsors={parsed.sponsors} />
      <CommitteeReviewList dates={parsed.committeeReview} />
    </div>
  );
}

/**
 * Returns a plain-text version of the agenda item for sharing.
 * Kept in sync with the parser so share text matches what the user sees.
 */
export function getAgendaItemShareTitle(item: MeetingItem): string {
  return [item.agendaObjectItemOutlineNumber, item.agendaObjectItemName]
    .filter(Boolean)
    .join(" ")
    .replace(/<[^>]+>/g, "");
}
