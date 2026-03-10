"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LatestBusinessCard } from "@/components/LatestBusinessCard";
import { CommitteeMeetingList } from "@/components/CommitteeMeetingList";
import { FollowCategoryButton } from "@/components/FollowCategoryButton";
import { COMMITTEES } from "@/lib/committees";

const committee = COMMITTEES["governing-body"];
const SCROLL_KEY = "governing-body-scroll";

function saveScroll() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  } catch {
    // ignore
  }
}

export function GoverningBodyScrollRestore() {
  const hasRestored = useRef(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 150);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const onContentLoaded = useCallback(() => {
    if (typeof window === "undefined" || hasRestored.current) return;
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved !== null) {
        const y = parseInt(saved, 10);
        if (!isNaN(y)) {
          hasRestored.current = true;
          sessionStorage.removeItem(SCROLL_KEY);
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: "auto" });
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save scroll position when user clicks a link to a meeting (navigating away)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href*="/meeting/"]');
      if (link) {
        saveScroll();
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return (
    <>
      {/* Sticky Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm transition-transform duration-300 ${
          isScrolled ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 bg-indigo-100 rounded-md flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 truncate">{committee.displayName}</span>
          </div>
          <div className="shrink-0">
            <FollowCategoryButton
              categoryName={committee.categoryName}
              displayName={committee.displayName}
              variant="compact"
            />
          </div>
        </div>
      </div>

      <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all meetings
        </Link>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{committee.displayName}</h1>
              <p className="text-gray-500">{committee.description}</p>
            </div>
          </div>
          <FollowCategoryButton
            categoryName={committee.categoryName}
            displayName={committee.displayName}
            variant="default"
          />
        </div>

        <div className="mb-8">
          <LatestBusinessCard
            committeeSlug="governing-body"
            committeeName={committee.displayName}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Meetings</h2>
          <CommitteeMeetingList
            categoryName={committee.categoryName}
            committeeSlug="governing-body"
            limit={15}
            onLoaded={onContentLoaded}
          />
        </div>
      </div>
      </main>
    </>
  );
}
