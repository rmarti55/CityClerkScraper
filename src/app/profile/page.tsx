"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface NotificationPreferences {
  emailDigestEnabled: string;
  confirmationEmailEnabled: string;
  meetingReminderEnabled: string;
  meetingReminderMinutesBefore: number;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPrefs = useCallback(async () => {
    const res = await fetch("/api/notifications/preferences");
    if (!res.ok) {
      setPrefs(null);
      return;
    }
    const data = await res.json();
    setPrefs({
      emailDigestEnabled: data.emailDigestEnabled ?? "true",
      confirmationEmailEnabled: data.confirmationEmailEnabled ?? "true",
      meetingReminderEnabled: data.meetingReminderEnabled ?? "true",
      meetingReminderMinutesBefore: data.meetingReminderMinutesBefore ?? 60,
    });
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchPrefs().finally(() => setLoading(false));
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, fetchPrefs]);

  const updatePref = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!prefs) return;
      setSaving(true);
      setMessage(null);
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update");
        setPrefs((prev) => (prev ? { ...prev, ...updates } : null));
        setMessage({ type: "success", text: "Saved." });
      } catch {
        setMessage({ type: "error", text: "Could not save. Try again." });
      } finally {
        setSaving(false);
      }
    },
    [prefs]
  );

  const toggle = useCallback(
    (key: keyof NotificationPreferences, value: "true" | "false") => {
      if (key === "meetingReminderMinutesBefore") return;
      updatePref({ [key]: value });
    },
    [updatePref]
  );

  const setReminderMinutes = useCallback(
    (minutes: number) => {
      updatePref({ meetingReminderMinutesBefore: minutes });
    },
    [updatePref]
  );

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to meetings
          </Link>
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Alert settings</h1>
            <p className="text-gray-600">Sign in to manage your email and reminder preferences.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/my-follows"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to My Follow
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Alert settings</h1>
        <p className="text-gray-500 mb-8">
          Choose how you want to be notified about followed categories and meetings.
        </p>

        {message && (
          <p
            className={`mb-4 text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}
          >
            {message.text}
          </p>
        )}

        {prefs && (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
            <label className="flex items-center justify-between gap-4 px-4 py-4">
              <span className="font-medium text-gray-900">Daily digest</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.emailDigestEnabled === "true"}
                disabled={saving}
                onClick={() =>
                  toggle("emailDigestEnabled", prefs.emailDigestEnabled === "true" ? "false" : "true")
                }
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                  prefs.emailDigestEnabled === "true"
                    ? "border-indigo-600 bg-indigo-600"
                    : "border-gray-200 bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    prefs.emailDigestEnabled === "true" ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
            <p className="px-4 pb-4 text-sm text-gray-500">
              One email per day with upcoming meetings in your followed categories.
            </p>

            <label className="flex items-center justify-between gap-4 px-4 py-4">
              <span className="font-medium text-gray-900">Confirmation when I follow</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.confirmationEmailEnabled === "true"}
                disabled={saving}
                onClick={() =>
                  toggle(
                    "confirmationEmailEnabled",
                    prefs.confirmationEmailEnabled === "true" ? "false" : "true"
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                  prefs.confirmationEmailEnabled === "true"
                    ? "border-indigo-600 bg-indigo-600"
                    : "border-gray-200 bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    prefs.confirmationEmailEnabled === "true" ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
            <p className="px-4 pb-4 text-sm text-gray-500">
              Send an email when you follow a category or meeting.
            </p>

            <label className="flex items-center justify-between gap-4 px-4 py-4">
              <span className="font-medium text-gray-900">Meeting reminder</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.meetingReminderEnabled === "true"}
                disabled={saving}
                onClick={() =>
                  toggle(
                    "meetingReminderEnabled",
                    prefs.meetingReminderEnabled === "true" ? "false" : "true"
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                  prefs.meetingReminderEnabled === "true"
                    ? "border-indigo-600 bg-indigo-600"
                    : "border-gray-200 bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    prefs.meetingReminderEnabled === "true" ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-500 mb-2">
                Remind me before meetings I follow.
              </p>
              <select
                value={prefs.meetingReminderMinutesBefore}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                disabled={saving || prefs.meetingReminderEnabled !== "true"}
                className="mt-1 block rounded-md border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value={60}>1 hour before</option>
                <option value={30}>30 minutes before</option>
                <option value={15}>15 minutes before</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
