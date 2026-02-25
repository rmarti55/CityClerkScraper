import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { categoryFollows, notificationPreferences } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sendFollowConfirmationEmail } from "@/emails/follow-confirmation";

/**
 * GET /api/follows/categories
 * Returns the list of category names the current user follows.
 * Returns [] if not authenticated.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ categoryNames: [] });
    }

    const rows = await db
      .select({ categoryName: categoryFollows.categoryName })
      .from(categoryFollows)
      .where(eq(categoryFollows.userId, session.user.id));

    return NextResponse.json({
      categoryNames: rows.map((r) => r.categoryName),
    });
  } catch (err) {
    console.error("GET /api/follows/categories failed:", err);
    return NextResponse.json(
      { error: "Failed to load category follows" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/follows/categories
 * Body: { categoryName: string }
 * Follow a category (e.g. "Governing Body"). Requires authentication.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to follow categories" },
      { status: 401 }
    );
  }

  let body: { categoryName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const categoryName =
    typeof body.categoryName === "string" ? body.categoryName.trim() : "";
  if (!categoryName) {
    return NextResponse.json(
      { error: "categoryName is required" },
      { status: 400 }
    );
  }

  try {
    await db
      .insert(categoryFollows)
      .values({
        userId: session.user.id,
        categoryName,
      })
      .onConflictDoNothing({
        target: [categoryFollows.userId, categoryFollows.categoryName],
      });
  } catch (err) {
    console.error("Failed to follow category:", err);
    return NextResponse.json(
      { error: "Failed to follow category" },
      { status: 500 }
    );
  }

  const appUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const to = session.user?.email;
  if (to) {
    const prefs = await db
      .select({ confirmationEmailEnabled: notificationPreferences.confirmationEmailEnabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.user.id));
    const sendConfirmation = prefs[0]?.confirmationEmailEnabled !== "false";
    if (sendConfirmation) {
      sendFollowConfirmationEmail({ to, type: "category", name: categoryName, appUrl }).catch(
        (err) => console.error("Follow confirmation email failed:", err)
      );
    }
  }

  return NextResponse.json({ ok: true, categoryName });
}

/**
 * DELETE /api/follows/categories?categoryName=Governing%20Body
 * Unfollow a category. Requires authentication.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to unfollow categories" },
      { status: 401 }
    );
  }

  const categoryName = request.nextUrl.searchParams.get("categoryName");
  if (!categoryName || !categoryName.trim()) {
    return NextResponse.json(
      { error: "categoryName query parameter is required" },
      { status: 400 }
    );
  }

  try {
    await db
      .delete(categoryFollows)
      .where(
        and(
          eq(categoryFollows.userId, session.user.id),
          eq(categoryFollows.categoryName, categoryName.trim())
        )
      );
  } catch (err) {
    console.error("Failed to unfollow category:", err);
    return NextResponse.json(
      { error: "Failed to unfollow category" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, categoryName: categoryName.trim() });
}
