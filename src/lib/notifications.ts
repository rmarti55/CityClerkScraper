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
  meetingTranscripts,
} from "@/lib/db/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { sendDigestEmail, type DigestMeeting } from "@/emails/digest";
import { sendMeetingReminderEmail } from "@/emails/meeting-reminder";
import { sendAgendaPostedEmail } from "@/emails/agenda-posted";
import { sendTranscriptReadyEmail } from "@/emails/transcript-ready";

const DIGEST_TYPE = "daily_digest";
const REMINDER_TYPE = "meeting_reminder";
const AGENDA_POSTED_TYPE = "agenda_posted";
const TRANSCRIPT_READY_TYPE = "transcript_ready";
const UPCOMING_DAYS = 7;

/**
 * Run the daily digest job: for each user with category follows and email enabled,
 * if we haven't sent today, gather upcoming meetings for their categories and send one email.
 */
export async function runDailyDigest(): Promise<{ sent: number; errors: string[] }> {
  const appUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const errors: string[] = [];
  let sent = 0;

  // Users who follow at least one category
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

  // Users with email digest enabled (default true if no row)
  const prefs = await db
    .select({ userId: notificationPreferences.userId, emailDigestEnabled: notificationPreferences.emailDigestEnabled })
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.userId, userIds));

  const digestEnabled = new Set(
    prefs.filter((p) => p.emailDigestEnabled !== "false").map((p) => p.userId)
  );
  for (const uid of userIds) {
    if (!prefs.some((p) => p.userId === uid)) digestEnabled.add(uid);
  }

  // Already sent today (any daily_digest for this user today, anchored to Denver midnight)
  const todayStart = DateTime.now().setZone("America/Denver").startOf("day").toJSDate();
  const sentToday = await db
    .select({ userId: sentNotifications.userId })
    .from(sentNotifications)
    .where(
      and(
        eq(sentNotifications.type, DIGEST_TYPE),
        gte(sentNotifications.sentAt, todayStart)
      )
    );
  const sentTodaySet = new Set(sentToday.map((s) => s.userId));

  const now = new Date();
  const windowEnd = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);

  const userList = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));

  for (const user of userList) {
    if (!digestEnabled.has(user.id) || sentTodaySet.has(user.id)) continue;

    const categories = userIdToCategories.get(user.id) ?? [];
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
          inArray(events.categoryName, categories)
        )
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

    try {
      const { error } = await sendDigestEmail({
        to: user.email,
        categoryMeetings,
        appUrl,
      });
      if (error) {
        errors.push(`User ${user.id}: ${String(error)}`);
        continue;
      }
      await db.insert(sentNotifications).values({
        userId: user.id,
        type: DIGEST_TYPE,
        categoryName: null,
        payload: JSON.stringify({ meetingCount: total, categories }),
      });
      sent++;
    } catch (err) {
      errors.push(`User ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { sent, errors };
}

/**
 * Run meeting reminders: for each user who follows a meeting (favorite) and has
 * meeting reminders enabled, if the meeting starts within their reminder window
 * (e.g. 55–65 min for 60-min setting), send one reminder and record in sent_notifications.
 */
export async function runMeetingReminders(): Promise<{
  sent: number;
  errors: string[];
}> {
  const appUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const errors: string[] = [];
  let sent = 0;

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
    ])
  );
  for (const uid of userIds) {
    if (!prefsByUser.has(uid)) prefsByUser.set(uid, { enabled: true, minutesBefore: 60 });
  }

  const alreadySent = await db
    .select({ userId: sentNotifications.userId, payload: sentNotifications.payload })
    .from(sentNotifications)
    .where(eq(sentNotifications.type, REMINDER_TYPE));
  const sentSet = new Set(alreadySent.map((s) => `${s.userId}:${s.payload}`));

  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  for (const row of favRows) {
    const userPref = prefsByUser.get(row.userId);
    if (!userPref?.enabled) continue;

    const min = userPref.minutesBefore;
    const windowStart = new Date(now.getTime() + (min - 5) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (min + 5) * 60 * 1000);
    const start = row.startDateTime.getTime();
    if (start < windowStart.getTime() || start > windowEnd.getTime()) continue;

    const key = `${row.userId}:${JSON.stringify({ eventId: row.eventId })}`;
    if (sentSet.has(key)) continue;

    const user = userById.get(row.userId);
    if (!user?.email) continue;

    try {
      const { error } = await sendMeetingReminderEmail({
        to: user.email,
        eventName: row.eventName,
        startDateTime: row.startDateTime.toISOString(),
        eventId: row.eventId,
        appUrl,
      });
      if (error) {
        errors.push(`User ${row.userId} event ${row.eventId}: ${String(error)}`);
        continue;
      }
      await db.insert(sentNotifications).values({
        userId: row.userId,
        type: REMINDER_TYPE,
        categoryName: null,
        payload: JSON.stringify({ eventId: row.eventId }),
      });
      sentSet.add(key);
      sent++;
    } catch (err) {
      errors.push(
        `User ${row.userId} event ${row.eventId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { sent, errors };
}

function getAppUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

/**
 * Detect events whose file_count increased since our last snapshot and notify
 * all users who follow that event's category. Uses the event_document_snapshots
 * table to track previously-known file counts.
 */
export async function runAgendaPostedNotifications(): Promise<{
  sent: number;
  errors: string[];
}> {
  const appUrl = getAppUrl();
  const errors: string[] = [];
  let sent = 0;

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
        gte(events.fileCount, 1)
      )
    );

  if (activeEvents.length === 0) return { sent: 0, errors: [] };

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

  const userIds = [...new Set(followRows.map((r) => r.userId))];

  const prefs = await db
    .select({
      userId: notificationPreferences.userId,
      agendaPostedEnabled: notificationPreferences.agendaPostedEnabled,
    })
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.userId, userIds));
  const disabledUsers = new Set(
    prefs.filter((p) => p.agendaPostedEnabled === "false").map((p) => p.userId)
  );

  const alreadySent = await db
    .select({ userId: sentNotifications.userId, payload: sentNotifications.payload })
    .from(sentNotifications)
    .where(eq(sentNotifications.type, AGENDA_POSTED_TYPE));
  const sentSet = new Set(alreadySent.map((s) => `${s.userId}:${s.payload}`));

  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const userCategories = new Map<string, Set<string>>();
  for (const row of followRows) {
    const set = userCategories.get(row.userId) ?? new Set();
    set.add(row.categoryName);
    userCategories.set(row.userId, set);
  }

  for (const evt of changedEvents) {
    for (const userId of userIds) {
      if (disabledUsers.has(userId)) continue;
      const cats = userCategories.get(userId);
      if (!cats?.has(evt.categoryName)) continue;

      const payload = JSON.stringify({ eventId: evt.id, fileCount: evt.newFiles });
      const key = `${userId}:${payload}`;
      if (sentSet.has(key)) continue;

      const user = userById.get(userId);
      if (!user?.email) continue;

      try {
        const { error } = await sendAgendaPostedEmail({
          to: user.email,
          eventName: evt.eventName,
          eventId: evt.id,
          categoryName: evt.categoryName,
          newFileCount: evt.newFiles,
          appUrl,
        });
        if (error) {
          errors.push(`User ${userId} event ${evt.id}: ${String(error)}`);
          continue;
        }
        await db.insert(sentNotifications).values({
          userId,
          type: AGENDA_POSTED_TYPE,
          categoryName: evt.categoryName,
          payload,
        });
        sentSet.add(key);
        sent++;
      } catch (err) {
        errors.push(
          `User ${userId} event ${evt.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  return { sent, errors };
}

/**
 * Send transcript-ready notifications for a specific event. Called from the
 * transcripts cron after a transcript is successfully processed.
 *
 * Notifies users who follow the event's category OR have the specific meeting starred.
 */
export async function notifyTranscriptReady(
  eventId: number,
  summarySnippet?: string
): Promise<{ sent: number; errors: string[] }> {
  const appUrl = getAppUrl();
  const errors: string[] = [];
  let sent = 0;

  const eventRows = await db
    .select({
      id: events.id,
      eventName: events.eventName,
      categoryName: events.categoryName,
    })
    .from(events)
    .where(eq(events.id, eventId));

  const evt = eventRows[0];
  if (!evt) return { sent: 0, errors: [`Event ${eventId} not found`] };

  const targetUserIds = new Set<string>();

  if (evt.categoryName) {
    const catFollows = await db
      .select({ userId: categoryFollows.userId })
      .from(categoryFollows)
      .where(eq(categoryFollows.categoryName, evt.categoryName));
    for (const r of catFollows) targetUserIds.add(r.userId);
  }

  const favRows = await db
    .select({ userId: favorites.userId })
    .from(favorites)
    .where(eq(favorites.eventId, eventId));
  for (const r of favRows) targetUserIds.add(r.userId);

  if (targetUserIds.size === 0) return { sent: 0, errors: [] };

  const userIds = [...targetUserIds];

  const prefs = await db
    .select({
      userId: notificationPreferences.userId,
      transcriptReadyEnabled: notificationPreferences.transcriptReadyEnabled,
    })
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.userId, userIds));
  const disabledUsers = new Set(
    prefs.filter((p) => p.transcriptReadyEnabled === "false").map((p) => p.userId)
  );

  const payload = JSON.stringify({ eventId });
  const alreadySent = await db
    .select({ userId: sentNotifications.userId })
    .from(sentNotifications)
    .where(
      and(
        eq(sentNotifications.type, TRANSCRIPT_READY_TYPE),
        eq(sentNotifications.payload, payload)
      )
    );
  const sentAlreadySet = new Set(alreadySent.map((s) => s.userId));

  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));

  for (const user of userRows) {
    if (disabledUsers.has(user.id)) continue;
    if (sentAlreadySet.has(user.id)) continue;
    if (!user.email) continue;

    try {
      const { error } = await sendTranscriptReadyEmail({
        to: user.email,
        eventName: evt.eventName,
        eventId: evt.id,
        summarySnippet,
        appUrl,
      });
      if (error) {
        errors.push(`User ${user.id}: ${String(error)}`);
        continue;
      }
      await db.insert(sentNotifications).values({
        userId: user.id,
        type: TRANSCRIPT_READY_TYPE,
        categoryName: evt.categoryName,
        payload,
      });
      sent++;
    } catch (err) {
      errors.push(`User ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { sent, errors };
}
