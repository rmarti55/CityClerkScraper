"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { CommitteeStats } from "@/lib/committees/stats";
import type { CommitteeLink } from "@/lib/committees/links";
import { PersonLink } from "./PersonLink";

interface LatestBusinessCardProps {
  committeeSlug: string;
  committeeName: string;
}

interface MemberRow {
  name: string;
  role: string | null;
}

interface OverviewData {
  stats: CommitteeStats;
  members: MemberRow[];
  membersScrapedAt: string | null;
  links: CommitteeLink[];
}

export function LatestBusinessCard({ committeeSlug, committeeName }: LatestBusinessCardProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch(`/api/committees/${committeeSlug}/overview`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load overview');
        return r.json() as Promise<OverviewData>;
      })
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'An error occurred'))
      .finally(() => setIsLoading(false));
  }, [committeeSlug]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-6 bg-gray-200 rounded w-40" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">Unable to load overview</span>
        </div>
        <p className="text-sm text-gray-800">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { stats, members, membersScrapedAt, links } = data;
  const typeEntries = Object.entries(stats.meetingTypeCounts).sort(([, a], [, b]) => b - a);

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100 p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-900">{committeeName} Overview</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Schedule & Resources */}
        <div className="space-y-6">
          {/* ── Section 1: Meeting Stats ── */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-2">
              Meeting Schedule
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.frequencyPattern && (
                <StatPill
                  label="Meets"
                  value={stats.frequencyPattern}
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                />
              )}
              {stats.totalMeetingsThisYear > 0 && (
                <StatPill
                  label={`Meetings in ${new Date().getFullYear()}`}
                  value={String(stats.totalMeetingsThisYear)}
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                />
              )}
              {typeEntries.length > 0 && (
                <StatPill
                  label="Meeting types"
                  value={typeEntries.map(([type, count]) => `${count} ${type}`).join(', ')}
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  }
                />
              )}
            </div>

            {/* Last met / Next meeting */}
            {(stats.lastMeeting || stats.nextMeeting) && (
              <div className="mt-3 bg-white rounded-lg border border-indigo-100 p-2.5 flex flex-col gap-1.5 text-xs">
                {stats.lastMeeting && (
                  <div className="flex items-start gap-1.5 text-gray-800">
                    <span className="shrink-0 text-gray-700 mt-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <span>
                      <span className="font-medium text-gray-800">Last met: </span>
                      {stats.lastMeeting.date}
                    </span>
                  </div>
                )}
                {stats.nextMeeting && (
                  <div className="flex items-start gap-1.5 text-gray-800">
                    <span className="shrink-0 text-indigo-400 mt-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3-3 3m-4-3h7M3 12a9 9 0 1018 0A9 9 0 003 12z" />
                      </svg>
                    </span>
                    <span>
                      <span className="font-medium text-indigo-700">Next meeting: </span>
                      {stats.nextMeeting.date}
                      {stats.nextMeeting.name && (
                        <span className="text-gray-600"> &mdash; {stats.nextMeeting.name}</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 3: Links ── */}
          {links.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-2">
                Resources
              </h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {links.map(link => {
                  const isInternal = link.url.startsWith('/');
                  const icon = isInternal ? (
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  );
                  return (
                    <li key={link.url}>
                      {isInternal ? (
                        <Link
                          href={link.url}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:underline bg-indigo-50/50 px-2 py-1 rounded-md border border-indigo-100/50"
                        >
                          {icon}
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:underline bg-indigo-50/50 px-2 py-1 rounded-md border border-indigo-100/50"
                        >
                          {icon}
                          {link.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: Members */}
        <div>
          {/* ── Section 2: Members ── */}
          {members.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                  Members
                </h3>
                {membersScrapedAt && (
                  <span className="text-xs text-gray-500">
                    Updated {new Date(membersScrapedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Denver',
                    })}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {members.map(m => (
                  <div key={m.name} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-2 py-1 rounded-md text-xs">
                    <PersonLink name={m.name}>
                      <span className="text-gray-800 font-medium">{m.name}</span>
                    </PersonLink>
                    {m.role && m.role !== 'Member' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        m.role === 'Chair'
                          ? 'bg-indigo-100 text-indigo-700'
                          : m.role === 'Mayor'
                          ? 'bg-amber-100 text-amber-700'
                          : m.role === 'Mayor Pro Tem'
                          ? 'bg-orange-100 text-orange-700'
                          : m.role === 'Alternate'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {m.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section 2 empty state ── */}
          {members.length === 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-2">
                Members
              </h3>
              <p className="text-xs text-gray-500 italic">
                Member roster not yet loaded.{' '}
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                  POST /api/admin/committees/{committeeSlug}/scrape-members
                </code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-component: stat pill ──────────────────────────────────

interface StatPillProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function StatPill({ label, value, icon }: StatPillProps) {
  return (
    <div className="bg-white rounded-md border border-indigo-100 px-2 py-1.5 flex flex-col gap-0.5 min-w-[100px]">
      <div className="flex items-center gap-1 text-gray-700">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-xs font-semibold text-gray-900 leading-snug">{value}</span>
    </div>
  );
}
