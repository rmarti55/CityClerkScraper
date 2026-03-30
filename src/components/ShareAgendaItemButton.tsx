"use client";

import { useSession } from "next-auth/react";
import { useLoginModal } from "@/context/LoginModalContext";
import { useToast } from "@/context/ToastContext";

interface ShareAgendaItemButtonProps {
  title: string;
  meetingInfo: string;
  shareUrl: string;
}

export function ShareAgendaItemButton({
  title,
  meetingInfo,
  shareUrl,
}: ShareAgendaItemButtonProps) {
  const { data: session } = useSession();
  const { openLoginModal } = useLoginModal();
  const { showToast } = useToast();

  async function handleShare() {
    if (!session?.user) {
      openLoginModal();
      showToast("Sign in to share agenda items.");
      return;
    }

    const fullUrl = `${window.location.origin}${shareUrl}`;
    const shareData = {
      title,
      text: meetingInfo,
      url: fullUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          await copyToClipboard(fullUrl);
        }
      }
    } else {
      await copyToClipboard(fullUrl);
    }
  }

  async function copyToClipboard(url: string) {
    const text = `${title}\n${meetingInfo}\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch {
      showToast("Unable to copy");
    }
  }

  return (
    <button
      onClick={handleShare}
      type="button"
      title="Share this agenda item"
      className="inline-flex items-center justify-center p-1.5 text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
    </button>
  );
}
