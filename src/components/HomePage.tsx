"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEvents } from "@/context/EventsContext";
import { useSearch } from "@/context/SearchContext";
import { getNowInDenver } from "@/lib/datetime";
import { COMMITTEES } from "@/lib/committees";
import { WarningIcon } from "./icons";
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
        <WarningIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
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
  } = useEvents();

  const { searchQuery, selectedCategory } = useSearch();

  const activeTab: TabValue = (() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && (tabParam === "all" || tabParam === "following" || tabParam === "saved-docs" || COMMITTEES[tabParam])) {
      return tabParam === "all" ? "all" : tabParam;
    }
    return "all";
  })();

  // Track whether a URL update was triggered by us (not browser nav / external)
  const isOwnUrlUpdateRef = useRef(false);
  const hasRestoredFromUrlRef = useRef(false);
  const hasInitialScrolledRef = useRef(false);

  // Restore calendar view from URL -- only on initial mount or browser back/forward,
  // not when we ourselves sync state to the URL.
  useEffect(() => {
    if (isOwnUrlUpdateRef.current) {
      isOwnUrlUpdateRef.current = false;
      return;
    }
    const monthParam = searchParams.get("month");
    if (monthParam && MONTH_PARAM_REGEX.test(monthParam)) {
      const [y, m] = monthParam.split("-").map((n) => parseInt(n, 10));
      if (m >= 1 && m <= 12 && y >= 2020 && y <= 2030 && (y !== currentYear || m !== currentMonth)) {
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
    hasRestoredFromUrlRef.current = true;
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
    isOwnUrlUpdateRef.current = true;
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [currentYear, currentMonth, scrollToDate, pathname, router, searchParams]);

  // Scroll to today on initial load only -- not on every month change or re-render.
  // The Today button in DateNav handles explicit user-initiated scrolling.
  useEffect(() => {
    if (hasInitialScrolledRef.current) return;
    if (hasActiveFilter) return;
    if (activeTab !== "all") return;
    const { year: todayYear, month: todayMonth, dateKey: todayDate } = getNowInDenver();
    if (currentYear === todayYear && currentMonth === todayMonth) {
      hasInitialScrolledRef.current = true;
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
      <div className="max-w-4xl mx-auto px-4 py-6 lg:max-w-none lg:px-12">
        {/* Tab content */}
        {activeTab === "all" ? (
          <>
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
