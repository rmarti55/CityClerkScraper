import { NextRequest, NextResponse } from "next/server";
import { runDailyDigest, runMeetingReminders, runAgendaPostedNotifications } from "@/lib/notifications";

/**
 * GET /api/cron/notifications
 * Runs digest, meeting reminders, and agenda-posted notifications.
 * Secure with CRON_SECRET (header or query).
 * Recommended: every 5 minutes via Vercel Cron (Pro) or external scheduler.
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
    const [digestResult, reminderResult, agendaResult] = await Promise.all([
      runDailyDigest(),
      runMeetingReminders(),
      runAgendaPostedNotifications(),
    ]);
    const allErrors = [
      ...digestResult.errors,
      ...reminderResult.errors,
      ...agendaResult.errors,
    ];
    return NextResponse.json({
      ok: true,
      digestSent: digestResult.sent,
      reminderSent: reminderResult.sent,
      agendaPostedSent: agendaResult.sent,
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
