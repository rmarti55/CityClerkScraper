"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface FollowsContextValue {
  isAuthenticated: boolean;
  sessionStatus: ReturnType<typeof useSession>["status"];
  favoriteEventIds: Set<number>;
  followedCategoryNames: Set<string>;
  loadingFavorites: boolean;
  loadingCategories: boolean;
  isFavorite: (eventId: number) => boolean;
  isFollowingCategory: (categoryName: string) => boolean;
  toggleFavorite: (eventId: number) => Promise<boolean>;
  toggleCategoryFollow: (categoryName: string) => Promise<boolean>;
  refetchFavorites: () => Promise<void>;
  refetchCategoryFollows: () => Promise<void>;
}

const FollowsContext = createContext<FollowsContextValue | null>(null);

export function FollowsProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [favoriteEventIds, setFavoriteEventIds] = useState<Set<number>>(
    new Set()
  );
  const [followedCategoryNames, setFollowedCategoryNames] = useState<Set<string>>(
    new Set()
  );
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const isAuthenticated = !!session?.user?.id;

  const fetchFavorites = useCallback(async () => {
    if (!isAuthenticated) {
      setFavoriteEventIds(new Set());
      setLoadingFavorites(false);
      return;
    }
    setLoadingFavorites(true);
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      if (data.eventIds && Array.isArray(data.eventIds)) {
        setFavoriteEventIds(new Set(data.eventIds));
      }
    } catch {
      setFavoriteEventIds(new Set());
    } finally {
      setLoadingFavorites(false);
    }
  }, [isAuthenticated]);

  const fetchCategoryFollows = useCallback(async () => {
    if (!isAuthenticated) {
      setFollowedCategoryNames(new Set());
      setLoadingCategories(false);
      return;
    }
    setLoadingCategories(true);
    try {
      const res = await fetch("/api/follows/categories");
      const data = await res.json();
      if (data.categoryNames && Array.isArray(data.categoryNames)) {
        setFollowedCategoryNames(new Set(data.categoryNames));
      }
    } catch {
      setFollowedCategoryNames(new Set());
    } finally {
      setLoadingCategories(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    fetchCategoryFollows();
  }, [fetchCategoryFollows]);

  const toggleFavorite = useCallback(
    async (eventId: number): Promise<boolean> => {
      if (!isAuthenticated) return false;
      const isFav = favoriteEventIds.has(eventId);
      const nextFav = !isFav;
      setFavoriteEventIds((prev) => {
        const next = new Set(prev);
        if (nextFav) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
      try {
        if (nextFav) {
          const res = await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId }),
          });
          if (!res.ok) throw new Error("Failed to add favorite");
        } else {
          const res = await fetch(`/api/favorites?eventId=${eventId}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Failed to remove favorite");
        }
        return true;
      } catch {
        setFavoriteEventIds((prev) => {
          const next = new Set(prev);
          if (nextFav) next.delete(eventId);
          else next.add(eventId);
          return next;
        });
        return false;
      }
    },
    [isAuthenticated, favoriteEventIds]
  );

  const toggleCategoryFollow = useCallback(
    async (categoryName: string): Promise<boolean> => {
      if (!isAuthenticated) return false;
      const isFollowed = followedCategoryNames.has(categoryName);
      const nextFollowed = !isFollowed;
      setFollowedCategoryNames((prev) => {
        const next = new Set(prev);
        if (nextFollowed) next.add(categoryName);
        else next.delete(categoryName);
        return next;
      });
      try {
        if (nextFollowed) {
          const res = await fetch("/api/follows/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categoryName }),
          });
          if (!res.ok) throw new Error("Failed to follow category");
        } else {
          const res = await fetch(
            `/api/follows/categories?categoryName=${encodeURIComponent(categoryName)}`,
            { method: "DELETE" }
          );
          if (!res.ok) throw new Error("Failed to unfollow category");
        }
        return true;
      } catch {
        setFollowedCategoryNames((prev) => {
          const next = new Set(prev);
          if (nextFollowed) next.delete(categoryName);
          else next.add(categoryName);
          return next;
        });
        return false;
      }
    },
    [isAuthenticated, followedCategoryNames]
  );

  const value: FollowsContextValue = {
    isAuthenticated,
    sessionStatus: status,
    favoriteEventIds,
    followedCategoryNames,
    loadingFavorites,
    loadingCategories,
    isFavorite: (eventId: number) => favoriteEventIds.has(eventId),
    isFollowingCategory: (categoryName: string) =>
      followedCategoryNames.has(categoryName),
    toggleFavorite,
    toggleCategoryFollow,
    refetchFavorites: fetchFavorites,
    refetchCategoryFollows: fetchCategoryFollows,
  };

  return (
    <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>
  );
}

export function useFollows(): FollowsContextValue {
  const ctx = useContext(FollowsContext);
  if (!ctx) {
    throw new Error("useFollows must be used within a FollowsProvider");
  }
  return ctx;
}
