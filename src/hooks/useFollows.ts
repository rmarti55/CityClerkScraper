"use client";

/**
 * Hook to manage favorite events and followed categories.
 * Returns current state and toggle functions; unauthenticated toggles no-op or can open login.
 * Must be used within FollowsProvider (state is shared to avoid duplicate API requests).
 */
export { useFollows } from "@/context/FollowsContext";
