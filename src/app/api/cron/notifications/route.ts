import { NextRequest, NextResponse } from "next/server";
import { runDailyDigest } from "@/lib/notifications";

/**
 * GET /api/cron/notifications
 * Runs the daily digest job. Secure with CRON_SECRET (header or query).
 * Call from Vercel Cron or external scheduler (e.g. daily at 8am).
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
    const { sent, errors } = await runDailyDigest();
    return NextResponse.json({
      ok: true,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Cron notifications error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
