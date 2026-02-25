"use client";

import { useState, useRef, useEffect } from "react";
import { useCategories, Category } from "@/hooks/useCategories";
import { useIsMobile } from "@/hooks/useDeviceCapabilities";
import { CategoryFilterModal } from "./CategoryFilterModal";

interface CategoryFilterProps {
  selectedCategory: Category | null;
  onSelectCategory: (category: Category | null) => void;
  /** Compact styling for sticky header (smaller trigger) */
  compact?: boolean;
}

export function CategoryFilter({
  selectedCategory,
  onSelectCategory,
  compact = false,
}: CategoryFilterProps) {
  const { categories, isLoading } = useCategories();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Filter categories by search term
  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    // Skip click-outside handling on mobile - the modal handles its own closing
    if (isMobile) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (category: Category | null) => {
    onSelectCategory(category);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelect(null);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Dropdown trigger button - full width on mobile */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex items-center gap-1.5 rounded-lg border transition-colors
            ${compact ? "px-2 py-1.5 text-xs font-medium min-h-[32px] min-w-[32px] h-auto" : "px-3 py-3 text-sm font-medium h-[50px] w-full sm:w-auto"}
            ${
              selectedCategory
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }
          `}
          disabled={isLoading}
        >
          <svg
            className={`flex-shrink-0 ${compact ? "w-3.5 h-3.5" : "w-4 h-4"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className={compact ? "max-w-[80px] truncate hidden sm:inline" : "max-w-[150px] truncate"}>
            {isLoading
              ? "…"
              : selectedCategory
              ? selectedCategory.name
              : compact
              ? "Filter"
              : "Filter by Category"}
          </span>
          {selectedCategory ? (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === "Enter" && handleClear(e as unknown as React.MouseEvent)}
              className="ml-auto flex-shrink-0 p-0.5 rounded hover:bg-indigo-200 transition-colors"
              title="Clear filter"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </span>
          ) : (
            <svg
              className={`ml-auto w-4 h-4 flex-shrink-0 transition-transform ${isOpen && !isMobile ? "rotate-180" : ""}`}
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
          )}
        </button>

        {/* Desktop dropdown menu */}
        {isOpen && !isMobile && (
          <div className="absolute z-50 mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-lg">
            {/* Search input */}
            <div className="p-2 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Category list */}
            <div className="max-h-64 overflow-y-auto">
              {/* All categories option */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`
                  w-full px-4 py-2 text-left text-sm flex items-center justify-between
                  hover:bg-gray-50 transition-colors
                  ${!selectedCategory ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}
                `}
              >
                <span className="font-medium">All Categories</span>
                {!selectedCategory && (
                  <svg
                    className="w-4 h-4 text-indigo-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Filtered categories */}
              {filteredCategories.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  No categories found
                </div>
              ) : (
                filteredCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleSelect(category)}
                    className={`
                      w-full px-4 py-2 text-left text-sm flex items-center justify-between gap-3
                      hover:bg-gray-50 transition-colors
                      ${
                        selectedCategory?.id === category.id
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-700"
                      }
                    `}
                  >
                    <span className="flex-1">{category.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        ({category.meetingCount || 0})
                      </span>
                      {selectedCategory?.id === category.id && (
                        <svg
                          className="w-4 h-4 text-indigo-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile fullscreen modal */}
      <CategoryFilterModal
        isOpen={isOpen && isMobile}
        onClose={() => {
          setIsOpen(false);
          setSearchTerm("");
        }}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
      />
    </>
  );
}
