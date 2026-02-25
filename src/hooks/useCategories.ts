"use client";

import { useState, useEffect } from "react";

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  meetingCount?: number;
}

interface UseCategoriesResult {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
}

// Version the cache key to force refresh when data structure changes
const CACHE_KEY = "cityclerk_categories_cache_v3";
const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 min so dropdown counts stay in sync with DB

interface CachedData {
  categories: Category[];
  fetchedAt: string;
}

/**
 * Hook for fetching and caching event categories
 */
export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      // Try cache first
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const data: CachedData = JSON.parse(cached);
          const cacheAge = Date.now() - new Date(data.fetchedAt).getTime();
          if (cacheAge < CACHE_DURATION_MS) {
            setCategories(data.categories);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to load categories from cache:", e);
      }

      // Fetch from API
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/categories");
        if (!response.ok) {
          throw new Error(`Failed to fetch categories: ${response.status}`);
        }

        const data = await response.json();
        setCategories(data.categories);

        // Cache the result
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              categories: data.categories,
              fetchedAt: data.fetchedAt,
            })
          );
        } catch (e) {
          console.warn("Failed to cache categories:", e);
        }
      } catch (err) {
        console.error("Categories fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load categories");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, isLoading, error };
}
