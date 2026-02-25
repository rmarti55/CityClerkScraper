import { NextRequest, NextResponse } from "next/server";
import { runDailyDigest, runMeetingReminders } from "@/lib/notifications";

/**
 * GET /api/cron/notifications
 * Runs the daily digest and meeting reminders. Secure with CRON_SECRET (header or query).
 * Call from Vercel Cron or external scheduler (e.g. daily at 8am for digest; every 15 min for reminders).
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [digestResult, reminderResult] = await Promise.all([
      runDailyDigest(),
      runMeetingReminders(),
    ]);
    const allErrors = [...digestResult.errors, ...reminderResult.errors];
    return NextResponse.json({
      ok: true,
      digestSent: digestResult.sent,
      reminderSent: reminderResult.sent,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (err) {
    console.error("Cron notifications error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
