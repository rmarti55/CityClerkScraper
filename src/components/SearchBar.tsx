"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useDeviceCapabilities";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (query: string) => void;
  isSearching?: boolean;
  placeholder?: string;
  recentSearches?: string[];
  onSelectRecentSearch?: (term: string) => void;
  onRemoveRecentSearch?: (term: string) => void;
  onMobileSearchOpen?: () => void;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  isSearching = false,
  placeholder = "Search meetings, agendas, minutes...",
  recentSearches = [],
  onSelectRecentSearch,
  onRemoveRecentSearch,
  onMobileSearchOpen,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isMobile = useIsMobile();

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  const handleCancel = useCallback(() => {
    onChange("");
    setIsFocused(false);
    inputRef.current?.blur();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter") {
        // Submit search and save to history
        const trimmed = value.trim();
        if (trimmed.length >= 2) {
          onSubmit?.(trimmed);
        }
        // Blur input to dismiss keyboard on mobile
        inputRef.current?.blur();
        setIsFocused(false);
      }
    },
    [handleCancel, value, onSubmit]
  );

  const handleFocus = useCallback(() => {
    // On mobile, open the full-screen search modal instead of inline focus
    if (isMobile && onMobileSearchOpen) {
      inputRef.current?.blur();
      onMobileSearchOpen();
      return;
    }
    setIsFocused(true);
  }, [isMobile, onMobileSearchOpen]);

  // Click outside handler - close dropdown when clicking outside
  useEffect(() => {
    if (!isFocused) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };

    // Use mousedown/touchstart for immediate response
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isFocused]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Check if the new focus target is within our container
    // Use a small delay to allow click events on dropdown items to fire first
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsFocused(false);
      }
    }, 150);
  }, []);

  const handleSelectRecentSearch = useCallback(
    (term: string) => {
      onChange(term);
      onSelectRecentSearch?.(term);
      setIsFocused(false);
      inputRef.current?.blur();
    },
    [onChange, onSelectRecentSearch]
  );

  const handleRemoveRecentSearch = useCallback(
    (e: React.MouseEvent, term: string) => {
      e.stopPropagation();
      e.preventDefault();
      onRemoveRecentSearch?.(term);
    },
    [onRemoveRecentSearch]
  );

  // Show dropdown when focused, has recent searches, and input is empty or very short
  // Only show on desktop - mobile uses full-screen modal
  const showDropdown =
    !isMobile && isFocused && recentSearches.length > 0 && value.trim().length < 2;

  return (
    <div className="flex items-center gap-2" ref={containerRef}>
      <div className="relative flex-1">
        {/* Search icon */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          {isSearching ? (
            <svg
              className="w-5 h-5 text-gray-400 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-gray-400"
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
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-3 text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
        />

        {/* Clear button - only show on desktop or when there's text */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors z-10"
            aria-label="Clear search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Recent searches dropdown */}
        {showDropdown && (
        <div 
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          role="listbox"
          aria-label="Recent searches"
        >
          <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Recent Searches
          </div>
          <ul className="py-1">
            {recentSearches.map((term) => (
              <li key={term} className="group">
                <div
                  role="option"
                  tabIndex={0}
                  onClick={() => handleSelectRecentSearch(term)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectRecentSearch(term);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 sm:py-2.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation cursor-pointer"
                  style={{ minHeight: "44px" }}
                >
                  {/* Clock icon */}
                  <svg
                    className="w-4 h-4 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  
                  {/* Search term */}
                  <span className="flex-1 text-gray-700 truncate text-sm sm:text-base">
                    {term}
                  </span>
                  
                  {/* Remove button - always visible on touch devices, hover-reveal on desktop */}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveRecentSearch(e, term)}
                    className="p-1.5 text-gray-400 can-hover:hover:text-gray-600 rounded-full can-hover:hover:bg-gray-200 active:bg-gray-200 transition-colors can-hover:opacity-0 can-hover:group-hover:opacity-100 focus:opacity-100 touch-manipulation"
                    aria-label={`Remove "${term}" from recent searches`}
                    style={{ minWidth: "32px", minHeight: "32px" }}
                  >
                    <svg
                      className="w-4 h-4 mx-auto"
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
              </li>
            ))}
          </ul>
        </div>
        )}
      </div>

      {/* Cancel button - only visible on mobile when focused (desktop only, mobile uses full-screen modal) */}
      {!isMobile && isFocused && (
        <button
          type="button"
          onClick={handleCancel}
          className="text-indigo-600 text-sm font-medium whitespace-nowrap sm:hidden touch-manipulation"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
