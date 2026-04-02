"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { SettingRow } from "@/components/SettingRow";
import {
  MailIcon,
  CheckCircleIcon,
  BellIcon,
  FileTextIcon,
  MessageSquareIcon,
  ChevronDownIcon,
} from "@/components/icons";

interface NotificationPreferences {
  emailDigestEnabled: string;
  confirmationEmailEnabled: string;
  meetingReminderEnabled: string;
  meetingReminderMinutesBefore: number;
  agendaPostedEnabled: string;
  transcriptReadyEnabled: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchPrefs = useCallback(async () => {
    setLoadError(false);
    const res = await fetch("/api/notifications/preferences");
    if (!res.ok) {
      setLoadError(true);
      setPrefs(null);
      return;
    }
    const data = await res.json();
    setPrefs({
      emailDigestEnabled: data.emailDigestEnabled ?? "true",
      confirmationEmailEnabled: data.confirmationEmailEnabled ?? "true",
      meetingReminderEnabled: data.meetingReminderEnabled ?? "true",
      meetingReminderMinutesBefore: data.meetingReminderMinutesBefore ?? 60,
      agendaPostedEnabled: data.agendaPostedEnabled ?? "true",
      transcriptReadyEnabled: data.transcriptReadyEnabled ?? "true",
    });
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchPrefs().finally(() => setLoading(false));
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, fetchPrefs]);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, text });
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const updatePref = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!prefs) return;
      setSaving(true);
      setPrefs((prev) => (prev ? { ...prev, ...updates } : null));
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update");
        showToast("success", "Saved");
      } catch {
        setPrefs((prev) => (prev ? { ...prev, ...Object.fromEntries(Object.keys(updates).map((k) => [k, prefs[k as keyof NotificationPreferences]])) } : null));
        showToast("error", "Could not save. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [prefs, showToast]
  );

  const toggle = useCallback(
    (key: keyof NotificationPreferences, checked: boolean) => {
      if (key === "meetingReminderMinutesBefore") return;
      updatePref({ [key]: checked ? "true" : "false" });
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
        <div className="mx-auto max-w-xl px-4 py-8">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white px-5 py-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-5 w-5 rounded bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-32 rounded bg-gray-200" />
                      <div className="h-6 w-11 rounded-full bg-gray-200" />
                    </div>
                    <div className="h-3 w-56 rounded bg-gray-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-xl px-4 py-8">
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <h1 className="text-lg font-semibold text-gray-900 mb-1">Alert settings</h1>
            <p className="text-sm text-gray-600">Sign in to manage your email and reminder preferences.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-xl px-4 py-8">
        <p className="text-sm text-gray-600 mb-5">
          Choose how you want to be notified about followed categories and meetings.
        </p>

        {/* Toast */}
        <div
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
            toast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
          }`}
        >
          {toast && (
            <div
              className={`rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
                toast.type === "success"
                  ? "bg-gray-900 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {toast.text}
            </div>
          )}
        </div>

        {loadError && !prefs ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-600 mb-3">
              Couldn&apos;t load your preferences.
            </p>
            <button
              onClick={() => {
                setLoading(true);
                fetchPrefs().finally(() => setLoading(false));
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Try again
            </button>
          </div>
        ) : prefs ? (
          <div className="space-y-3">
            <SettingRow
              id="toggle-digest"
              icon={<MailIcon className="w-5 h-5" />}
              title="Daily digest"
              description="One email per day with upcoming meetings in your followed categories."
              checked={prefs.emailDigestEnabled === "true"}
              onChange={(checked) => toggle("emailDigestEnabled", checked)}
              disabled={saving}
            />

            <SettingRow
              id="toggle-confirmation"
              icon={<CheckCircleIcon className="w-5 h-5" />}
              title="Confirmation when I follow"
              description="Send an email when you follow a category or meeting."
              checked={prefs.confirmationEmailEnabled === "true"}
              onChange={(checked) => toggle("confirmationEmailEnabled", checked)}
              disabled={saving}
            />

            <SettingRow
              id="toggle-reminder"
              icon={<BellIcon className="w-5 h-5" />}
              title="Meeting reminder"
              description="Remind me before meetings I follow."
              checked={prefs.meetingReminderEnabled === "true"}
              onChange={(checked) => toggle("meetingReminderEnabled", checked)}
              disabled={saving}
            >
              <div className="relative inline-block">
                <label htmlFor="reminder-minutes" className="sr-only">
                  Reminder lead time
                </label>
                <select
                  id="reminder-minutes"
                  value={prefs.meetingReminderMinutesBefore}
                  onChange={(e) => setReminderMinutes(Number(e.target.value))}
                  disabled={saving}
                  className="appearance-none rounded-md border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={60}>1 hour before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={15}>15 minutes before</option>
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </SettingRow>

            <SettingRow
              id="toggle-agenda"
              icon={<FileTextIcon className="w-5 h-5" />}
              title="Agenda / documents posted"
              description="Get an email when new agendas, packets, or documents are posted to meetings in categories you follow."
              checked={prefs.agendaPostedEnabled === "true"}
              onChange={(checked) => toggle("agendaPostedEnabled", checked)}
              disabled={saving}
            />

            <SettingRow
              id="toggle-transcript"
              icon={<MessageSquareIcon className="w-5 h-5" />}
              title="Transcript ready"
              description="Get an email when an AI-generated transcript and summary become available for meetings you follow."
              checked={prefs.transcriptReadyEnabled === "true"}
              onChange={(checked) => toggle("transcriptReadyEnabled", checked)}
              disabled={saving}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
