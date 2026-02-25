import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { favorites, notificationPreferences, events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sendFollowConfirmationEmail } from "@/emails/follow-confirmation";

/**
 * GET /api/favorites
 * Returns the list of event IDs the current user has favorited.
 * Returns [] if not authenticated.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ eventIds: [] });
  }

  const rows = await db
    .select({ eventId: favorites.eventId })
    .from(favorites)
    .where(eq(favorites.userId, session.user.id));

  return NextResponse.json({
    eventIds: rows.map((r) => r.eventId),
  });
}

/**
 * POST /api/favorites
 * Body: { eventId: number }
 * Adds an event to the user's favorites. Requires authentication.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to follow meetings" },
      { status: 401 }
    );
  }

  let body: { eventId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const eventId = typeof body.eventId === "number" ? body.eventId : undefined;
  if (eventId == null || eventId <= 0) {
    return NextResponse.json(
      { error: "eventId is required and must be a positive number" },
      { status: 400 }
    );
  }

  try {
    await db
      .insert(favorites)
      .values({
        userId: session.user.id,
        eventId,
      })
      .onConflictDoNothing({
        target: [favorites.userId, favorites.eventId],
      });
  } catch (err) {
    console.error("Failed to add favorite:", err);
    return NextResponse.json(
      { error: "Failed to follow meeting" },
      { status: 500 }
    );
  }

  const appUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const to = session.user?.email;
  if (to) {
    const [prefs, eventRows] = await Promise.all([
      db
        .select({ confirmationEmailEnabled: notificationPreferences.confirmationEmailEnabled })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, session.user.id)),
      db.select({ eventName: events.eventName }).from(events).where(eq(events.id, eventId)),
    ]);
    const sendConfirmation = prefs[0]?.confirmationEmailEnabled !== "false";
    const eventName = eventRows[0]?.eventName ?? "Meeting";
    if (sendConfirmation) {
      sendFollowConfirmationEmail({
        to,
        type: "meeting",
        name: eventName,
        appUrl,
      }).catch((err) => console.error("Follow confirmation email failed:", err));
    }
  }

  return NextResponse.json({ ok: true, eventId });
}

/**
 * DELETE /api/favorites?eventId=123
 * Removes an event from the user's favorites. Requires authentication.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to unfollow meetings" },
      { status: 401 }
    );
  }

  const eventIdParam = request.nextUrl.searchParams.get("eventId");
  const eventId = eventIdParam ? parseInt(eventIdParam, 10) : NaN;
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json(
      { error: "eventId query parameter is required and must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    await db
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, session.user.id),
          eq(favorites.eventId, eventId)
        )
      );
  } catch (err) {
    console.error("Failed to remove favorite:", err);
    return NextResponse.json(
      { error: "Failed to unfollow meeting" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, eventId });
}
