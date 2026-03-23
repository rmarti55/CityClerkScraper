"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEvents } from "@/context/EventsContext";
import { useSearch } from "@/context/SearchContext";
import { getNowInDenver } from "@/lib/datetime";
import { COMMITTEES } from "@/lib/committees";
import { MonthPicker } from "./MonthPicker";
import { SearchableContent } from "./SearchableContent";
import { TabValue } from "./TabBar";
import { MeetingListSkeleton } from "./skeletons/MeetingCardSkeleton";
import { CommitteeMeetingList } from "./CommitteeMeetingList";
import { FollowCategoryButton } from "./FollowCategoryButton";
import { FollowingTabContent } from "./FollowingTabContent";
import { SavedDocsTabContent } from "./SavedDocsTabContent";

function ErrorState({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <svg
          className="w-6 h-6 text-red-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <h3 className="font-medium text-red-600">Failed to Load Meetings</h3>
          <p className="text-sm text-red-600 mt-1">{error}</p>
        </div>
      </div>
    </div>
  );
}

const MONTH_PARAM_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PARAM_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function HomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const {
    isLoading,
    error,
    getEventsForMonth,
    currentYear,
    currentMonth,
    scrollToDate,
    setScrollToDate,
    setCurrentMonth,
    refresh,
  } = useEvents();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { searchQuery, selectedCategory } = useSearch();

  const activeTab: TabValue = (() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && (tabParam === "all" || tabParam === "following" || tabParam === "saved-docs" || COMMITTEES[tabParam])) {
      return tabParam === "all" ? "all" : tabParam;
    }
    return "all";
  })();

  // Restore calendar view from URL
  useEffect(() => {
    const monthParam = searchParams.get("month");
    if (monthParam && MONTH_PARAM_REGEX.test(monthParam)) {
      const [y, m] = monthParam.split("-").map((n) => parseInt(n, 10));
      if (m >= 1 && m <= 12 && y >= 2020 && y <= 2030) {
        setCurrentMonth(y, m);
      }
    }
    const dateParam = searchParams.get("date");
    if (dateParam && DATE_PARAM_REGEX.test(dateParam)) {
      const d = new Date(dateParam + "T12:00:00");
      if (!Number.isNaN(d.getTime())) {
        setScrollToDate(dateParam);
      }
    }
  }, [searchParams, setCurrentMonth, setScrollToDate]);

  const hasActiveFilter = searchQuery.trim().length >= 2 || selectedCategory !== null;

  // Sync calendar view to URL
  useEffect(() => {
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    const currentMonthParam = searchParams.get("month");
    const currentDateParam = searchParams.get("date") ?? null;
    const effectiveDate = scrollToDate ?? currentDateParam;
    if (currentMonthParam === monthStr && currentDateParam === effectiveDate) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", monthStr);
    if (scrollToDate) {
      params.set("date", scrollToDate);
    }
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [currentYear, currentMonth, scrollToDate, pathname, router, searchParams]);

  // Open on today
  useEffect(() => {
    if (hasActiveFilter) return;
    if (activeTab !== "all") return;
    const { year: todayYear, month: todayMonth, dateKey: todayDate } = getNowInDenver();
    if (currentYear === todayYear && currentMonth === todayMonth) {
      setScrollToDate(todayDate);
    }
  }, [hasActiveFilter, activeTab, currentYear, currentMonth, setScrollToDate]);

  const events = getEventsForMonth(currentYear, currentMonth);

  const isCommitteeTab = activeTab !== "all";
  const committee = isCommitteeTab ? COMMITTEES[activeTab] : null;

  if (activeTab === "saved-docs") {
    return <SavedDocsTabContent />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab content */}
        {activeTab === "all" ? (
          <>
            <MonthPicker hasActiveFilter={hasActiveFilter} />

            {isLoading ? (
              <MeetingListSkeleton count={5} />
            ) : error ? (
              <ErrorState error={error} />
            ) : (
              <SearchableContent
                events={events}
                year={currentYear}
                month={currentMonth}
                scrollToDate={scrollToDate ?? undefined}
              />
            )}
          </>
        ) : activeTab === "following" ? (
          <FollowingTabContent />
        ) : committee ? (
          <CommitteeTabContent
            committeeSlug={activeTab}
            committee={committee}
          />
        ) : null}
      </div>
    </main>
  );
}

function CommitteeTabContent({
  committeeSlug,
  committee,
}: {
  committeeSlug: string;
  committee: (typeof COMMITTEES)[string];
}) {
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{committee.displayName}</h2>
          <p className="text-gray-600 text-sm mt-0.5">{committee.description}</p>
        </div>
        <FollowCategoryButton
          categoryName={committee.categoryName}
          displayName={committee.displayName}
          variant="default"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CommitteeMeetingList
          categoryName={committee.categoryName}
          committeeSlug={committeeSlug}
          limit={15}
        />
      </div>
    </div>
  );
}
