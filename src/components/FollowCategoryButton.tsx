"use client";

import { useFollows } from "@/hooks/useFollows";
import { useLoginModal } from "@/context/LoginModalContext";

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
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Following
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
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
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          Following {label}
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Follow {label} for updates
        </>
      )}
    </button>
  );
}

