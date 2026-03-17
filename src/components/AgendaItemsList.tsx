"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import type { MeetingItem, ItemAttachment } from "@/lib/types";
import type { AgendaItemSummary } from "@/lib/llm/agenda-summary";
import { normalizeOutlineNumber } from "@/lib/agenda-items";
import { FileMetadata } from "@/components/FileMetadata";
import { ShareAgendaItemButton } from "@/components/ShareAgendaItemButton";
import { AgendaItemContent } from "@/components/AgendaItemContent";

function AttachmentCard({
  attachment,
  meetingId,
  agendaId,
}: {
  attachment: ItemAttachment;
  meetingId: number;
  agendaId: number;
}) {
  const viewUrl = `/api/attachment/${attachment.id}?agendaId=${agendaId}`;
  const downloadUrl = `/api/attachment/${attachment.id}?agendaId=${agendaId}&download=true&name=${encodeURIComponent(attachment.fileName)}`;
  const chatUrl = `/meeting/${meetingId}/attachment/${attachment.id}?name=${encodeURIComponent(attachment.fileName)}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            <path d="M8 12h8v2H8zM8 15h8v2H8z" />
          </svg>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 leading-tight">{attachment.fileName}</h3>
            <FileMetadata attachmentId={attachment.id} agendaId={agendaId} />
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col sm:flex-shrink-0">
          <Link
            href={chatUrl}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </Link>
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View
          </a>
          <a
            href={downloadUrl}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

interface AgendaItemsListProps {
  items: MeetingItem[];
  agendaId: number;
  eventId: number;
  meetingInfo: string;
  summaries?: AgendaItemSummary[] | null;
}

export function AgendaItemsList({
  items,
  agendaId,
  eventId,
  meetingInfo,
  summaries,
}: AgendaItemsListProps) {
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());

  const summaryMap = useMemo(() => {
    if (!summaries?.length) return null;
    const byId = new Map<number, AgendaItemSummary>();
    const byOutline = new Map<string, AgendaItemSummary>();
    for (const s of summaries) {
      if (s.itemId) byId.set(s.itemId, s);
      byOutline.set(normalizeOutlineNumber(s.outlineNumber), s);
    }
    return { byId, byOutline };
  }, [summaries]);

  const getSummary = useCallback(
    (item: MeetingItem): AgendaItemSummary | undefined => {
      if (!summaryMap) return undefined;
      return (
        summaryMap.byId.get(item.id) ??
        summaryMap.byOutline.get(normalizeOutlineNumber(item.agendaObjectItemOutlineNumber))
      );
    },
    [summaryMap],
  );

  const allCollapsed = collapsed.size === items.length;

  const toggleItem = useCallback((itemId: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allCollapsed) {
      setCollapsed(new Set());
    } else {
      setCollapsed(new Set(items.map((item) => item.id)));
    }
  }, [allCollapsed, items]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Agenda Items ({items.length} with documents)
        </h2>
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          {allCollapsed ? "Expand All" : "Collapse All"}
        </button>
      </div>
      <div className="space-y-4">
        {items.map((item) => {
          const isCollapsed = collapsed.has(item.id);
          return (
            <div
              key={item.id}
              id={`item-${item.id}`}
              className="border border-gray-200 rounded-lg overflow-hidden scroll-mt-16"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleItem(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleItem(item.id);
                  }
                }}
                className="w-full bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-start gap-2 text-left cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <svg
                  className={`w-4 h-4 text-gray-400 mt-0.5 shrink-0 transition-transform duration-200 ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <AgendaItemContent item={item} summary={getSummary(item)} />
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <ShareAgendaItemButton
                    title={[item.agendaObjectItemOutlineNumber, item.agendaObjectItemName]
                      .filter(Boolean)
                      .join(" ")
                      .replace(/<[^>]+>/g, "")}
                    meetingInfo={meetingInfo}
                    shareUrl={`/meeting/${eventId}#item-${item.id}`}
                  />
                </div>
              </div>
              {!isCollapsed && (
                <div className="p-3 space-y-2">
                  {(item.attachmentsList ?? []).map((att: ItemAttachment) => (
                    <AttachmentCard
                      key={att.id}
                      attachment={att}
                      meetingId={eventId}
                      agendaId={agendaId}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
