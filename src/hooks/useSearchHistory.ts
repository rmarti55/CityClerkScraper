"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "searchHistory";
const MAX_HISTORY_SIZE = 5;
const MIN_SEARCH_LENGTH = 2;

/**
 * Hook for managing recent search history with localStorage persistence
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load history from localStorage on mount (client-side only)
  useEffect(() => {
    // Mark as hydrated first
    setIsHydrated(true);
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, MAX_HISTORY_SIZE));
        }
      }
    } catch (err) {
      console.error("Failed to load search history:", err);
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveHistory = useCallback((newHistory: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch (err) {
      console.error("Failed to save search history:", err);
    }
  }, []);

  // Add a search term to history
  const addSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    
    // Only save searches with minimum length
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      return;
    }

    setHistory((prev) => {
      // Remove if already exists (will be moved to front)
      const filtered = prev.filter(
        (item) => item.toLowerCase() !== trimmed.toLowerCase()
      );
      
      // Add to front and limit size
      const newHistory = [trimmed, ...filtered].slice(0, MAX_HISTORY_SIZE);
      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  // Remove a specific search term from history
  const removeSearch = useCallback((term: string) => {
    setHistory((prev) => {
      const newHistory = prev.filter(
        (item) => item.toLowerCase() !== term.toLowerCase()
      );
      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear search history:", err);
    }
  }, []);

  return {
    history,
    addSearch,
    removeSearch,
    clearHistory,
    isHydrated,
  };
}
