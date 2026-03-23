"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { Category, useCategories } from "@/hooks/useCategories";

interface SearchContextValue {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: Category | null;
  setSelectedCategory: (category: Category | null) => void;
  isSearching: boolean;
  setIsSearching: (v: boolean) => void;
  isMobileSearchOpen: boolean;
  setIsMobileSearchOpen: (v: boolean) => void;
  history: string[];
  addSearch: (term: string) => void;
  removeSearch: (term: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearch must be used within SearchProvider");
  }
  return ctx;
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const { categories } = useCategories();
  const { history, addSearch, removeSearch } = useSearchHistory();

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("q") || ""
  );
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Restore category from URL param once categories load
  useEffect(() => {
    const categoryIdParam = searchParams.get("category");
    if (categoryIdParam && categories.length > 0) {
      const categoryId = parseInt(categoryIdParam, 10);
      const found = categories.find((c) => c.id === categoryId);
      if (found) {
        setSelectedCategory(found);
      }
    }
  }, [categories, searchParams]);

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        isSearching,
        setIsSearching,
        isMobileSearchOpen,
        setIsMobileSearchOpen,
        history,
        addSearch,
        removeSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}
