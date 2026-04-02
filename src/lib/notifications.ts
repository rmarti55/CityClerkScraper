import { db } from "@/lib/db";
import { DateTime } from "luxon";
import {
  users,
  categoryFollows,
  notificationPreferences,
  sentNotifications,
  events,
  favorites,
  eventDocumentSnapshots,
} from "@/lib/db/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { sendDigestEmail, type DigestMeeting } from "@/emails/digest";
import { sendMeetingReminderEmail } from "@/emails/meeting-reminder";
import { sendAgendaPostedEmail } from "@/emails/agenda-posted";
import { sendTranscriptReadyEmail, type TranscriptEmailSummary, type TranscriptEmailTopic } from "@/emails/transcript-ready";
import { getAppBaseUrl } from "@/lib/url";

const DIGEST_TYPE = "daily_digest";
const REMINDER_TYPE = "meeting_reminder";
const AGENDA_POSTED_TYPE = "agenda_posted";
const TRANSCRIPT_READY_TYPE = "transcript_ready";
const UPCOMING_DAYS = 7;

// ---------------------------------------------------------------------------
// Generic notification runner
// ---------------------------------------------------------------------------

type PrefKey =
  | "emailDigestEnabled"
  | "meetingReminderEnabled"
  | "agendaPostedEnabled"
  | "transcriptReadyEnabled";

interface SendItem {
  userId: string;
  dedupePayload: string;
  categoryName: string | null;
  sendEmail: (user: { id: string; email: string }, appUrl: string) => Promise<{ error: unknown }>;
}

/**
 * Core send-and-record loop shared by every notification type.
 *
 * Given a list of pre-filtered send items, this function:
 *   1. Resolves user emails
 *   2. Checks notification preferences (default-true when no row exists)
 *   3. Deduplicates against sent_notifications
 *   4. Sends emails and records successes
 */
async function sendToEligibleUsers(
  items: SendItem[],
  opts: {
    type: string;
    prefKey: PrefKey;
    existingSentKeys?: Set<string>;
  },
): Promise<{ sent: number; errors: string[] }> {
  if (items.length === 0) return { sent: 0, errors: [] };

  const appUrl = getAppBaseUrl();
  const errors: string[] = [];
  let sent = 0;

  const userIds = [...new Set(items.map((i) => i.userId))];

  // Preference check: default-true when no row exists for this user
  const prefs = await db
    .select({ userId: notificationPreferences.userId, value: notificationPreferences[opts.prefKey] })
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.userId, userIds));
  const disabledUsers = new Set(
    prefs.filter((p) => p.value === "false").map((p) => p.userId),
  );

  // Dedup: use caller-provided set, or build from DB
  const sentKeys = opts.existingSentKeys ?? new Set<string>();
  if (!opts.existingSentKeys) {
    const alreadySent = await db
      .select({ userId: sentNotifications.userId, payload: sentNotifications.payload })
      .from(sentNotifications)
      .where(eq(sentNotifications.type, opts.type));
    for (const s of alreadySent) sentKeys.add(`${s.userId}:${s.payload}`);
  }

  // Resolve user emails in one query
  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  for (const item of items) {
    if (disabledUsers.has(item.userId)) continue;

    const key = `${item.userId}:${item.dedupePayload}`;
    if (sentKeys.has(key)) continue;

    const user = userById.get(item.userId);
    if (!user?.email) continue;

    try {
      const { error } = await item.sendEmail(user, appUrl);
      if (error) {
        errors.push(`User ${user.id}: ${String(error)}`);
        continue;
      }
      await db.insert(sentNotifications).values({
        userId: user.id,
        type: opts.type,
        categoryName: item.categoryName,
        payload: item.dedupePayload,
      });
      sentKeys.add(key);
      sent++;
    } catch (err) {
      errors.push(`User ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { sent, errors };
}

// ---------------------------------------------------------------------------
// Daily digest
// ---------------------------------------------------------------------------

export async function runDailyDigest(): Promise<{ sent: number; errors: string[] }> {
  const followRows = await db
    .select({ userId: categoryFollows.userId, categoryName: categoryFollows.categoryName })
    .from(categoryFollows);

  const userIdToCategories = new Map<string, string[]>();
  for (const row of followRows) {
    const list = userIdToCategories.get(row.userId) ?? [];
    if (!list.includes(row.categoryName)) list.push(row.categoryName);
    userIdToCategories.set(row.userId, list);
  }

  const userIds = Array.from(userIdToCategories.keys());
  if (userIds.length === 0) return { sent: 0, errors: [] };

  // Date-based dedup: anyone already sent today (Denver midnight anchor)
  const todayStart = DateTime.now().setZone("America/Denver").startOf("day").toJSDate();
  const sentToday = await db
    .select({ userId: sentNotifications.userId })
    .from(sentNotifications)
    .where(
      and(
        eq(sentNotifications.type, DIGEST_TYPE),
        gte(sentNotifications.sentAt, todayStart),
      ),
    );
  const sentTodaySet = new Set(sentToday.map((s) => s.userId));

  const now = new Date();
  const windowEnd = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);

  // Build per-user send items with pre-queried meeting data
  const items: SendItem[] = [];

  for (const [userId, categories] of userIdToCategories) {
    if (sentTodaySet.has(userId)) continue;
    if (categories.length === 0) continue;

    const eventRows = await db
      .select({
        id: events.id,
        eventName: events.eventName,
        startDateTime: events.startDateTime,
        categoryName: events.categoryName,
      })
      .from(events)
      .where(
        and(
          gte(events.startDateTime, now),
          lte(events.startDateTime, windowEnd),
          inArray(events.categoryName, categories),
        ),
      )
      .orderBy(events.startDateTime);

    const byCategory = new Map<string, DigestMeeting[]>();
    for (const row of eventRows) {
      const cat = row.categoryName ?? "Other";
      const list = byCategory.get(cat) ?? [];
      list.push({
        id: row.id,
        eventName: row.eventName,
        startDateTime: row.startDateTime.toISOString(),
        categoryName: cat,
      });
      byCategory.set(cat, list);
    }

    const categoryMeetings = categories.map((categoryName) => ({
      categoryName,
      meetings: byCategory.get(categoryName) ?? [],
    }));

    const total = categoryMeetings.reduce((sum, c) => sum + c.meetings.length, 0);
    if (total === 0) continue;

    const payload = JSON.stringify({ meetingCount: total, categories });
    items.push({
      userId,
      dedupePayload: payload,
      categoryName: null,
      sendEmail: (user, appUrl) =>
        sendDigestEmail({ to: user.email, categoryMeetings, appUrl }),
    });
  }

  // Digest uses date-based dedup above; pass an empty set so the runner
  // doesn't re-query sent_notifications (already filtered by sentTodaySet).
  return sendToEligibleUsers(items, {
    type: DIGEST_TYPE,
    prefKey: "emailDigestEnabled",
    existingSentKeys: new Set(),
  });
}

// ---------------------------------------------------------------------------
// Meeting reminders
// ---------------------------------------------------------------------------

export async function runMeetingReminders(): Promise<{ sent: number; errors: string[] }> {
  const now = new Date();

  const favRows = await db
    .select({
      userId: favorites.userId,
      eventId: favorites.eventId,
      eventName: events.eventName,
      startDateTime: events.startDateTime,
    })
    .from(favorites)
    .innerJoin(events, eq(favorites.eventId, events.id))
    .where(gte(events.startDateTime, now));

  if (favRows.length === 0) return { sent: 0, errors: [] };

  // Reminders need per-user minutesBefore, which is an extra pref field.
  // Query prefs once and use them both for the time-window filter and to
  // pass through to the generic runner via existingSentKeys.
  const userIds = [...new Set(favRows.map((r) => r.userId))];
  const prefs = await db
    .select({
      userId: notificationPreferences.userId,
      meetingReminderEnabled: notificationPreferences.meetingReminderEnabled,
      meetingReminderMinutesBefore: notificationPreferences.meetingReminderMinutesBefore,
    })
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.userId, userIds));

  const prefsByUser = new Map(
    prefs.map((p) => [
      p.userId,
      {
        enabled: p.meetingReminderEnabled !== "false",
        minutesBefore: p.meetingReminderMinutesBefore ?? 60,
      },
    ]),
  );
  for (const uid of userIds) {
    if (!prefsByUser.has(uid)) prefsByUser.set(uid, { enabled: true, minutesBefore: 60 });
  }

  // 7-day dedup window
  const reminderCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const alreadySent = await db
    .select({ userId: sentNotifications.userId, payload: sentNotifications.payload })
    .from(sentNotifications)
    .where(
      and(
        eq(sentNotifications.type, REMINDER_TYPE),
        gte(sentNotifications.sentAt, reminderCutoff),
      ),
    );
  const sentKeys = new Set(alreadySent.map((s) => `${s.userId}:${s.payload}`));

  const items: SendItem[] = [];

  for (const row of favRows) {
    const userPref = prefsByUser.get(row.userId);
    if (!userPref?.enabled) continue;

    const min = userPref.minutesBefore;
    const windowStart = new Date(now.getTime() + (min - 5) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (min + 5) * 60 * 1000);
    const start = row.startDateTime.getTime();
    if (start < windowStart.getTime() || start > windowEnd.getTime()) continue;

    const payload = JSON.stringify({ eventId: row.eventId });
    items.push({
      userId: row.userId,
      dedupePayload: payload,
      categoryName: null,
      sendEmail: (user, appUrl) =>
        sendMeetingReminderEmail({
          to: user.email,
          eventName: row.eventName,
          startDateTime: row.startDateTime.toISOString(),
          eventId: row.eventId,
          appUrl,
        }),
    });
  }

  // Pre-filtered by per-user prefs above; pass sentKeys so the runner
  // uses the 7-day-windowed set instead of querying all-time.
  return sendToEligibleUsers(items, {
    type: REMINDER_TYPE,
    prefKey: "meetingReminderEnabled",
    existingSentKeys: sentKeys,
  });
}

// ---------------------------------------------------------------------------
// Agenda-posted notifications
// ---------------------------------------------------------------------------

export async function runAgendaPostedNotifications(): Promise<{ sent: number; errors: string[] }> {
  const now = new Date();
  const pastWindow = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const futureWindow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const activeEvents = await db
    .select({
      id: events.id,
      eventName: events.eventName,
      categoryName: events.categoryName,
      fileCount: events.fileCount,
      startDateTime: events.startDateTime,
    })
    .from(events)
    .where(
      and(
        gte(events.startDateTime, pastWindow),
        lte(events.startDateTime, futureWindow),
        gte(events.fileCount, 1),
      ),
    );

  if (activeEvents.length === 0) return { sent: 0, errors: [] };

  // Snapshot diffing to detect new documents
  const eventIds = activeEvents.map((e) => e.id);
  const snapshots = await db
    .select()
    .from(eventDocumentSnapshots)
    .where(inArray(eventDocumentSnapshots.eventId, eventIds));
  const snapshotMap = new Map(snapshots.map((s) => [s.eventId, s]));

  const changedEvents: { id: number; eventName: string; categoryName: string; newFiles: number }[] = [];

  for (const evt of activeEvents) {
    const snap = snapshotMap.get(evt.id);
    const knownCount = snap?.knownFileCount ?? 0;
    const currentCount = evt.fileCount ?? 0;

    if (currentCount > knownCount) {
      changedEvents.push({
        id: evt.id,
        eventName: evt.eventName,
        categoryName: evt.categoryName ?? "",
        newFiles: currentCount - knownCount,
      });
    }

    await db
      .insert(eventDocumentSnapshots)
      .values({ eventId: evt.id, knownFileCount: currentCount, lastCheckedAt: now })
      .onConflictDoUpdate({
        target: [eventDocumentSnapshots.eventId],
        set: { knownFileCount: currentCount, lastCheckedAt: now },
      });
  }

  if (changedEvents.length === 0) return { sent: 0, errors: [] };

  const affectedCategories = [...new Set(changedEvents.map((e) => e.categoryName).filter(Boolean))];
  if (affectedCategories.length === 0) return { sent: 0, errors: [] };

  const followRows = await db
    .select({ userId: categoryFollows.userId, categoryName: categoryFollows.categoryName })
    .from(categoryFollows)
    .where(inArray(categoryFollows.categoryName, affectedCategories));

  if (followRows.length === 0) return { sent: 0, errors: [] };

  const userCategories = new Map<string, Set<string>>();
  for (const row of followRows) {
    const set = userCategories.get(row.userId) ?? new Set();
    set.add(row.categoryName);
    userCategories.set(row.userId, set);
  }

  const items: SendItem[] = [];
  for (const evt of changedEvents) {
    for (const [userId, cats] of userCategories) {
      if (!cats.has(evt.categoryName)) continue;

      const payload = JSON.stringify({ eventId: evt.id, fileCount: evt.newFiles });
      items.push({
        userId,
        dedupePayload: payload,
        categoryName: evt.categoryName,
        sendEmail: (user, appUrl) =>
          sendAgendaPostedEmail({
            to: user.email,
            eventName: evt.eventName,
            eventId: evt.id,
            categoryName: evt.categoryName,
            newFileCount: evt.newFiles,
            appUrl,
          }),
      });
    }
  }

  return sendToEligibleUsers(items, {
    type: AGENDA_POSTED_TYPE,
    prefKey: "agendaPostedEnabled",
  });
}

// ---------------------------------------------------------------------------
// Transcript-ready notifications
// ---------------------------------------------------------------------------

export async function notifyTranscriptReady(
  eventId: number,
  opts?: {
    summary?: TranscriptEmailSummary;
    topics?: TranscriptEmailTopic[];
  },
): Promise<{ sent: number; errors: string[] }> {
  const eventRows = await db
    .select({
      id: events.id,
      eventName: events.eventName,
      categoryName: events.categoryName,
      startDateTime: events.startDateTime,
    })
    .from(events)
    .where(eq(events.id, eventId));

  const evt = eventRows[0];
  if (!evt) return { sent: 0, errors: [`Event ${eventId} not found`] };

  // Collect users from both category follows and meeting favorites
  const categoryFollowerIds = new Set<string>();
  const meetingFollowerIds = new Set<string>();

  if (evt.categoryName) {
    const catFollows = await db
      .select({ userId: categoryFollows.userId })
      .from(categoryFollows)
      .where(eq(categoryFollows.categoryName, evt.categoryName));
    for (const r of catFollows) categoryFollowerIds.add(r.userId);
  }

  const favRows = await db
    .select({ userId: favorites.userId })
    .from(favorites)
    .where(eq(favorites.eventId, eventId));
  for (const r of favRows) meetingFollowerIds.add(r.userId);

  const targetUserIds = new Set([...categoryFollowerIds, ...meetingFollowerIds]);
  if (targetUserIds.size === 0) return { sent: 0, errors: [] };

  // Payload-based dedup scoped to this event
  const payload = JSON.stringify({ eventId });
  const alreadySent = await db
    .select({ userId: sentNotifications.userId })
    .from(sentNotifications)
    .where(
      and(
        eq(sentNotifications.type, TRANSCRIPT_READY_TYPE),
        eq(sentNotifications.payload, payload),
      ),
    );
  const sentKeys = new Set(alreadySent.map((s) => `${s.userId}:${payload}`));

  const items: SendItem[] = [];
  for (const userId of targetUserIds) {
    const followsCategory = categoryFollowerIds.has(userId);
    const followsMeeting = meetingFollowerIds.has(userId);
    let reason: string;
    if (followsCategory && followsMeeting) {
      reason = `You follow the category "${evt.categoryName}" and this meeting.`;
    } else if (followsCategory) {
      reason = `You follow the category "${evt.categoryName}".`;
    } else {
      reason = "You follow this meeting.";
    }

    items.push({
      userId,
      dedupePayload: payload,
      categoryName: evt.categoryName,
      sendEmail: (user, appUrl) =>
        sendTranscriptReadyEmail({
          to: user.email,
          eventName: evt.eventName,
          eventId: evt.id,
          startDateTime: evt.startDateTime?.toISOString(),
          categoryName: evt.categoryName ?? undefined,
          summary: opts?.summary,
          topics: opts?.topics,
          reason,
          appUrl,
        }),
    });
  }

  return sendToEligibleUsers(items, {
    type: TRANSCRIPT_READY_TYPE,
    prefKey: "transcriptReadyEnabled",
    existingSentKeys: sentKeys,
  });
}
