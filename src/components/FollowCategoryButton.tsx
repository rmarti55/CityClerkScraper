"use client";

import { useFollows } from "@/hooks/useFollows";
import { useLoginModal } from "@/context/LoginModalContext";
import { StarFilledIcon, StarOutlineIcon } from "./icons";

interface FollowCategoryButtonProps {
  categoryName: string;
  /** Optional: display name (e.g. "Governing Body") */
  displayName?: string;
  /** Optional: smaller styling for inline use */
  variant?: "default" | "compact";
}

export function FollowCategoryButton({
  categoryName,
  displayName,
  variant = "default",
}: FollowCategoryButtonProps) {
  const { isAuthenticated, isFollowingCategory, toggleCategoryFollow, loadingCategories } =
    useFollows();
  const { openLoginModal } = useLoginModal();

  const isFollowing = isFollowingCategory(categoryName);
  const label = displayName ?? categoryName;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    await toggleCategoryFollow(categoryName);
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loadingCategories}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium rounded-md border transition-colors disabled:opacity-50"
        aria-pressed={isFollowing}
        aria-label={isFollowing ? `Unfollow ${label}` : `Follow ${label} for updates`}
        title={isFollowing ? `Unfollow ${label}` : `Follow ${label} to get email updates`}
        style={{
          borderColor: isFollowing ? "var(--color-follow-border, #c7d2fe)" : "#e5e7eb",
          backgroundColor: isFollowing ? "var(--color-follow-bg, #eef2ff)" : "white",
          color: isFollowing ? "#4338ca" : "#374151",
        }}
      >
        {isFollowing ? (
          <>
            <StarFilledIcon className="w-4 h-4" />
            Following
          </>
        ) : (
          <>
            <StarOutlineIcon className="w-4 h-4" />
            Follow
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loadingCategories}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50"
      aria-pressed={isFollowing}
      aria-label={isFollowing ? `Unfollow ${label}` : `Follow ${label} for updates`}
      title={isFollowing ? `Unfollow ${label}` : `Follow ${label} to get email updates`}
      style={{
        borderColor: isFollowing ? "#a5b4fc" : "#d1d5db",
        backgroundColor: isFollowing ? "#eef2ff" : "white",
        color: isFollowing ? "#4338ca" : "#374151",
      }}
    >
      {isFollowing ? (
        <>
          <StarFilledIcon className="w-5 h-5" />
          Following {label}
        </>
      ) : (
        <>
          <StarOutlineIcon className="w-5 h-5" />
          Follow {label} for updates
        </>
      )}
    </button>
  );
}

