import { db } from "@/lib/db";
import {
  users,
  categoryFollows,
  notificationPreferences,
  sentNotifications,
  events,
  favorites,
} from "@/lib/db/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { sendDigestEmail, type DigestMeeting } from "@/emails/digest";
import { sendMeetingReminderEmail } from "@/emails/meeting-reminder";

const DIGEST_TYPE = "daily_digest";
const REMINDER_TYPE = "meeting_reminder";
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

  // Already sent today (any daily_digest for this user today)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
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
