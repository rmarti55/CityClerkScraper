"use client";

import { useEvents } from "@/context/EventsContext";
import { getNowInDenver } from "@/lib/datetime";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DateNavProps {
  hasActiveFilter?: boolean;
}

export function DateNav({ hasActiveFilter = false }: DateNavProps) {
  const { currentYear, currentMonth, setCurrentMonth, setScrollToDate } = useEvents();

  const navigateToMonth = (year: number, month: number, scrollTo?: string) => {
    setCurrentMonth(year, month);
    setScrollToDate(scrollTo ?? null);
  };

  const scrollToDateElement = (dateStr: string) => {
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

    if (!targetElement && sortedElements.length > 0) {
      targetElement = sortedElements[sortedElements.length - 1];
    }

    if (targetElement) {
      const yOffset = -100;
      const y = targetElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "auto" });

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
    const { year: todayYear, month: todayMonth, dateKey: todayDate } = getNowInDenver();

    if (currentYear === todayYear && currentMonth === todayMonth) {
      scrollToDateElement(todayDate);
    } else {
      navigateToMonth(todayYear, todayMonth, todayDate);
    }
  };

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {/* Today button */}
      {!hasActiveFilter && (
        <button
          onClick={goToToday}
          className="px-2 py-1 pointer-coarse:min-h-[34px] text-xs font-medium text-indigo-600 can-hover:hover:bg-indigo-50 active:bg-indigo-50 rounded-md transition-colors whitespace-nowrap flex-shrink-0 border border-indigo-200"
        >
          Today
        </button>
      )}

      {/* Prev/Month/Year/Next grouped together */}
      <div className="flex items-center flex-shrink-0">
        <button
          onClick={goToPrevMonth}
          className="p-1 pointer-coarse:min-h-[34px] pointer-coarse:min-w-[34px] rounded-md can-hover:hover:bg-gray-100 active:bg-gray-100 transition-colors flex-shrink-0 flex items-center justify-center"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5 text-gray-900" />
        </button>

        <select
          value={currentMonth}
          onChange={(e) => navigateToMonth(currentYear, parseInt(e.target.value))}
          className="text-xs sm:text-sm font-semibold text-gray-900 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-0.5 py-0.5 pointer-coarse:min-h-[34px] appearance-none"
        >
          {MONTHS_FULL.map((month, index) => (
            <option key={month} value={index + 1}>
              {month}
            </option>
          ))}
        </select>

        <select
          value={currentYear}
          onChange={(e) => navigateToMonth(parseInt(e.target.value), currentMonth)}
          className="text-xs sm:text-sm font-semibold text-gray-900 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-0.5 py-0.5 pointer-coarse:min-h-[34px] appearance-none"
        >
          {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <button
          onClick={goToNextMonth}
          className="p-1 pointer-coarse:min-h-[34px] pointer-coarse:min-w-[34px] rounded-md can-hover:hover:bg-gray-100 active:bg-gray-100 transition-colors flex-shrink-0 flex items-center justify-center"
          aria-label="Next month"
        >
          <ChevronRightIcon className="w-3.5 h-3.5 text-gray-900" />
        </button>
      </div>
    </div>
  );
}
