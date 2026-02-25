import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notificationPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/notifications/preferences
 * Returns the current user's notification preferences.
 * Returns defaults if no row exists. 401 if not authenticated.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      emailDigestEnabled: notificationPreferences.emailDigestEnabled,
      confirmationEmailEnabled: notificationPreferences.confirmationEmailEnabled,
      meetingReminderEnabled: notificationPreferences.meetingReminderEnabled,
      meetingReminderMinutesBefore: notificationPreferences.meetingReminderMinutesBefore,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, session.user.id));

  const row = rows[0];
  return NextResponse.json({
    emailDigestEnabled: row?.emailDigestEnabled ?? "true",
    confirmationEmailEnabled: row?.confirmationEmailEnabled ?? "true",
    meetingReminderEnabled: row?.meetingReminderEnabled ?? "true",
    meetingReminderMinutesBefore: row?.meetingReminderMinutesBefore ?? 60,
  });
}

/**
 * PATCH /api/notifications/preferences
 * Body: { emailDigestEnabled?, confirmationEmailEnabled?, meetingReminderEnabled?, meetingReminderMinutesBefore? }
 * Upserts the current user's notification preferences. 401 if not authenticated.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    emailDigestEnabled?: string;
    confirmationEmailEnabled?: string;
    meetingReminderEnabled?: string;
    meetingReminderMinutesBefore?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: {
    emailDigestEnabled?: string;
    confirmationEmailEnabled?: string;
    meetingReminderEnabled?: string;
    meetingReminderMinutesBefore?: number;
    updatedAt?: Date;
  } = { updatedAt: new Date() };

  if (body.emailDigestEnabled !== undefined) {
    updates.emailDigestEnabled =
      body.emailDigestEnabled === "false" ? "false" : "true";
  }
  if (body.confirmationEmailEnabled !== undefined) {
    updates.confirmationEmailEnabled =
      body.confirmationEmailEnabled === "false" ? "false" : "true";
  }
  if (body.meetingReminderEnabled !== undefined) {
    updates.meetingReminderEnabled =
      body.meetingReminderEnabled === "false" ? "false" : "true";
  }
  if (
    body.meetingReminderMinutesBefore !== undefined &&
    Number.isInteger(body.meetingReminderMinutesBefore) &&
    body.meetingReminderMinutesBefore >= 0
  ) {
    updates.meetingReminderMinutesBefore = body.meetingReminderMinutesBefore;
  }

  try {
    await db
      .insert(notificationPreferences)
      .values({
        userId: session.user.id,
        emailDigestEnabled: updates.emailDigestEnabled ?? "true",
        confirmationEmailEnabled: updates.confirmationEmailEnabled ?? "true",
        meetingReminderEnabled: updates.meetingReminderEnabled ?? "true",
        meetingReminderMinutesBefore:
          updates.meetingReminderMinutesBefore ?? 60,
        updatedAt: updates.updatedAt,
      })
      .onConflictDoUpdate({
        target: [notificationPreferences.userId],
        set: {
          ...(updates.emailDigestEnabled !== undefined && {
            emailDigestEnabled: updates.emailDigestEnabled,
          }),
          ...(updates.confirmationEmailEnabled !== undefined && {
            confirmationEmailEnabled: updates.confirmationEmailEnabled,
          }),
          ...(updates.meetingReminderEnabled !== undefined && {
            meetingReminderEnabled: updates.meetingReminderEnabled,
          }),
          ...(updates.meetingReminderMinutesBefore !== undefined && {
            meetingReminderMinutesBefore: updates.meetingReminderMinutesBefore,
          }),
          updatedAt: updates.updatedAt!,
        },
      });
  } catch (err) {
    console.error("Failed to update notification preferences:", err);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
