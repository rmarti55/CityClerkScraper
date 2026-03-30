"use client";

import Link from "next/link";
import { COMMITTEES, CommitteeConfig } from "@/lib/committees";

const COLOR_MAP: Record<string, { dot: string; icon: string }> = {
  indigo: { dot: "bg-indigo-500", icon: "text-indigo-500" },
  amber: { dot: "bg-amber-500", icon: "text-amber-500" },
  emerald: { dot: "bg-emerald-500", icon: "text-emerald-500" },
  purple: { dot: "bg-purple-500", icon: "text-purple-500" },
  rose: { dot: "bg-rose-500", icon: "text-rose-500" },
  blue: { dot: "bg-blue-500", icon: "text-blue-500" },
};

export type TabValue = "all" | "none" | string;

interface TabBarProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  /** Compact mode for sticky header (smaller text, tighter spacing) */
  compact?: boolean;
}

const committees = Object.values(COMMITTEES) as CommitteeConfig[];

function CommitteeIcon({ committee, className }: { committee: CommitteeConfig; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      {committee.iconPaths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

export function TabBar({ activeTab, onTabChange, compact = false }: TabBarProps) {
  const tabBase = compact
    ? "px-3 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2 flex items-center"
    : "px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 flex items-center";

  const activeClass = "border-indigo-600 text-indigo-700 font-semibold";
  const inactiveClass = "border-transparent text-gray-600 font-medium hover:text-gray-800 hover:border-gray-300";

  return (
    <div className="tabs-scroll flex items-center gap-0 -mb-px">
      {/* All Meetings tab */}
      <button
        type="button"
        onClick={() => onTabChange("all")}
        className={`${tabBase} ${activeTab === "all" ? activeClass : inactiveClass}`}
        style={{ minHeight: compact ? 44 : undefined }}
      >
        {compact ? "All" : "All Meetings"}
      </button>

      {/* Committee tabs */}
      {committees.map((c) => {
        const isActive = activeTab === c.slug;
        const colors = COLOR_MAP[c.color] || COLOR_MAP.indigo;

        return (
          <button
            key={c.slug}
            type="button"
            onClick={() => onTabChange(c.slug)}
            className={`${tabBase} gap-1.5 ${isActive ? activeClass : inactiveClass}`}
            style={{ minHeight: compact ? 44 : undefined }}
          >
            {/* Desktop: SVG icon */}
            <span className="hidden sm:inline-flex">
              <CommitteeIcon committee={c} className={`w-3.5 h-3.5 ${colors.icon}`} />
            </span>
            {/* Mobile: color dot */}
            <span className={`sm:hidden w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
            {compact ? c.shortName : c.displayName}
          </button>
        );
      })}

      {/* People directory link */}
      <Link
        href="/people"
        className={`${tabBase} gap-1.5 ${activeTab === "people" ? activeClass : inactiveClass}`}
        style={{ minHeight: compact ? 44 : undefined }}
      >
        <span className="hidden sm:inline-flex">
          <svg className="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </span>
        <span className={`sm:hidden w-2 h-2 rounded-full flex-shrink-0 bg-teal-500`} />
        People
      </Link>

      {/* Following tab */}
      <button
        type="button"
        onClick={() => onTabChange("following")}
        className={`${tabBase} gap-1.5 ${activeTab === "following" ? activeClass : inactiveClass}`}
        style={{ minHeight: compact ? 44 : undefined }}
      >
        <span className="hidden sm:inline-flex">
          <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </span>
        <span className="sm:hidden w-2 h-2 rounded-full flex-shrink-0 bg-rose-500" />
        Following
      </button>

      {/* Saved docs tab */}
      <button
        type="button"
        onClick={() => onTabChange("saved-docs")}
        className={`${tabBase} gap-1.5 ${activeTab === "saved-docs" ? activeClass : inactiveClass}`}
        style={{ minHeight: compact ? 44 : undefined }}
      >
        <span className="hidden sm:inline-flex">
          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </span>
        <span className="sm:hidden w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" />
        Saved
      </button>
    </div>
  );
}
