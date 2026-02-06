"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

interface MonthPickerProps {
  currentYear: number;
  currentMonth: number;
}

export function MonthPicker({ currentYear, currentMonth }: MonthPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigateToMonth = (year: number, month: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", year.toString());
    params.set("month", month.toString());
    router.push(`/?${params.toString()}`);
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
    navigateToMonth(now.getFullYear(), now.getMonth() + 1);
  };

  // Prefetch prev/next month so navigation feels faster
  useEffect(() => {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const params = new URLSearchParams(searchParams.toString());
    const buildUrl = (y: number, m: number) => {
      const p = new URLSearchParams(params);
      p.set("year", y.toString());
      p.set("month", m.toString());
      return `/?${p.toString()}`;
    };
    router.prefetch(buildUrl(prevYear, prevMonth));
    router.prefetch(buildUrl(nextYear, nextMonth));
  }, [currentYear, currentMonth, searchParams, router]);

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-2">
        {/* Previous month */}
        <button
          onClick={goToPrevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
        <div className="flex items-center gap-2">
          <select
            value={currentMonth}
            onChange={(e) => navigateToMonth(currentYear, parseInt(e.target.value))}
            className="text-lg font-semibold text-gray-900 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1"
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
            className="text-lg font-semibold text-gray-900 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1"
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
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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

      {/* Today button */}
      <button
        onClick={goToToday}
        className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
      >
        Today
      </button>
    </div>
  );
}
