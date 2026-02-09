"use client";

import { useState, useRef, useEffect } from "react";
import { Category } from "@/hooks/useCategories";

interface CategoryFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  selectedCategory: Category | null;
  onSelectCategory: (category: Category | null) => void;
}

export function CategoryFilterModal({
  isOpen,
  onClose,
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Filter categories by search term
  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setShowSearch(false);
    }
  }, [isOpen]);

  // Focus search input when search is shown
  useEffect(() => {
    if (showSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSearch]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSelect = (category: Category | null) => {
    onSelectCategory(category);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Filter by Category</h2>
          <div className="flex items-center gap-2">
            {/* Search toggle button */}
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-full transition-colors ${
                showSearch ? "bg-indigo-100 text-indigo-600" : "text-gray-500 hover:bg-gray-100"
              }`}
              aria-label={showSearch ? "Hide search" : "Search categories"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
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
            </button>
          </div>
        </div>

        {/* Search input - collapsible */}
        {showSearch && (
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
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
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* All categories option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`
              w-full px-4 py-4 text-left flex items-center justify-between
              active:bg-gray-100 transition-colors touch-manipulation
              ${!selectedCategory ? "bg-indigo-50" : ""}
            `}
            style={{ minHeight: "56px" }}
          >
            <span className={`font-medium ${!selectedCategory ? "text-indigo-700" : "text-gray-900"}`}>
              All Categories
            </span>
            {!selectedCategory && (
              <svg
                className="w-5 h-5 text-indigo-600"
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
            <div className="px-4 py-8 text-center text-gray-500">
              No categories found
            </div>
          ) : (
            filteredCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleSelect(category)}
                className={`
                  w-full px-4 py-4 text-left flex items-center justify-between gap-3
                  active:bg-gray-100 transition-colors touch-manipulation border-b border-gray-50
                  ${selectedCategory?.id === category.id ? "bg-indigo-50" : ""}
                `}
                style={{ minHeight: "56px" }}
              >
                <span className={`flex-1 ${selectedCategory?.id === category.id ? "text-indigo-700" : "text-gray-900"}`}>
                  {category.name}
                </span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm text-gray-400">
                    {category.meetingCount || 0}
                  </span>
                  {selectedCategory?.id === category.id && (
                    <svg
                      className="w-5 h-5 text-indigo-600"
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

        {/* Safe area padding for iOS */}
        <div className="h-safe-area-inset-bottom flex-shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
      </div>
    </div>
  );
}
