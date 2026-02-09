"use client";

import { useEvents } from "@/context/EventsContext";

interface MonthPickerProps {
  hasActiveFilter?: boolean;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function MonthPicker({ hasActiveFilter = false }: MonthPickerProps) {
  const { currentYear, currentMonth, setCurrentMonth, setScrollToDate } = useEvents();

  const navigateToMonth = (year: number, month: number, scrollTo?: string) => {
    setCurrentMonth(year, month);
    if (scrollTo) {
      setScrollToDate(scrollTo);
    } else {
      setScrollToDate(null);
    }
  };

  // Helper to scroll to a date element directly (for same-month navigation)
  const scrollToDateElement = (dateStr: string) => {
    // Find the target element or nearest future date
    const allDateElements = document.querySelectorAll('[id^="date-"]');
    let targetElement: Element | null = null;

    const sortedElements = Array.from(allDateElements).sort((a, b) => {
      const dateA = a.id.replace("date-", "");
      const dateB = b.id.replace("date-", "");
      return dateA.localeCompare(dateB);
    });

    for (const el of sortedElements) {
      const elDate = el.id.replace("date-", "");
      if (elDate >= dateStr) {
        targetElement = el;
        break;
      }
    }

    // If no future date found, use the last one
    if (!targetElement && sortedElements.length > 0) {
      targetElement = sortedElements[sortedElements.length - 1];
    }

    if (targetElement) {
      const yOffset = -100;
      const y = targetElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });

      // Add highlight animation
      targetElement.classList.add("scroll-highlight");
      setTimeout(() => {
        targetElement?.classList.remove("scroll-highlight");
      }, 2000);
    }
  };

  const goToPrevMonth = () => {
    let newMonth = currentMonth - 1;
    let newYear = currentYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    navigateToMonth(newYear, newMonth);
  };

  const goToNextMonth = () => {
    let newMonth = currentMonth + 1;
    let newYear = currentYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    navigateToMonth(newYear, newMonth);
  };

  const goToToday = () => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1;
    const todayDate = now.toISOString().split("T")[0]; // "YYYY-MM-DD"

    if (currentYear === todayYear && currentMonth === todayMonth) {
      // Already on current month - just scroll to today's date
      scrollToDateElement(todayDate);
    } else {
      // Navigate to current month with scroll param
      navigateToMonth(todayYear, todayMonth, todayDate);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4 mb-6">
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Previous month */}
        <button
          onClick={goToPrevMonth}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Previous month"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Month/Year display */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <select
            value={currentMonth}
            onChange={(e) => navigateToMonth(currentYear, parseInt(e.target.value))}
            className="text-base sm:text-lg font-semibold text-gray-900 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1 sm:px-2 py-1"
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>

          <select
            value={currentYear}
            onChange={(e) => navigateToMonth(parseInt(e.target.value), currentMonth)}
            className="text-base sm:text-lg font-semibold text-gray-900 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1 sm:px-2 py-1"
          >
            {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(
              (year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              )
            )}
          </select>
        </div>

        {/* Next month */}
        <button
          onClick={goToNextMonth}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Next month"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Today button - hidden when search/filter is active */}
      {!hasActiveFilter && (
        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        >
          Today
        </button>
      )}
    </div>
  );
}
