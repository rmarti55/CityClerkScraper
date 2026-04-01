import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { savedDocuments, events } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { chatCompletion } from "@/lib/llm/openrouter";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ docs: [] });
  }

  const detail = request.nextUrl.searchParams.get("detail") === "true";

  if (detail) {
    const rows = await db
      .select({
        id: savedDocuments.id,
        documentType: savedDocuments.documentType,
        documentId: savedDocuments.documentId,
        eventId: savedDocuments.eventId,
        agendaId: savedDocuments.agendaId,
        documentName: savedDocuments.documentName,
        displayName: savedDocuments.displayName,
        documentCategory: savedDocuments.documentCategory,
        createdAt: savedDocuments.createdAt,
        eventName: events.eventName,
        eventDate: events.eventDate,
        startDateTime: events.startDateTime,
        categoryName: events.categoryName,
      })
      .from(savedDocuments)
      .leftJoin(events, eq(savedDocuments.eventId, events.id))
      .where(eq(savedDocuments.userId, session.user.id))
      .orderBy(desc(savedDocuments.createdAt));

    return NextResponse.json({ docs: rows });
  }

  const rows = await db
    .select({
      documentType: savedDocuments.documentType,
      documentId: savedDocuments.documentId,
    })
    .from(savedDocuments)
    .where(eq(savedDocuments.userId, session.user.id));

  return NextResponse.json({ docs: rows });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to save documents" },
      { status: 401 }
    );
  }

  let body: {
    documentType?: string;
    documentId?: number;
    eventId?: number;
    agendaId?: number;
    documentName?: string;
    documentCategory?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { documentType, documentId, eventId, agendaId, documentName, documentCategory } = body;

  if (
    (documentType !== "file" && documentType !== "attachment") ||
    typeof documentId !== "number" || documentId <= 0 ||
    typeof eventId !== "number" || eventId <= 0 ||
    typeof documentName !== "string" || !documentName.trim()
  ) {
    return NextResponse.json(
      { error: "documentType ('file'|'attachment'), documentId, eventId, and documentName are required" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  try {
    await db
      .insert(savedDocuments)
      .values({
        userId,
        documentType,
        documentId,
        eventId,
        agendaId: agendaId ?? null,
        documentName: documentName.trim(),
        documentCategory: documentCategory ?? null,
      })
      .onConflictDoNothing({
        target: [savedDocuments.userId, savedDocuments.documentType, savedDocuments.documentId],
      });
  } catch (err) {
    console.error("Failed to save document:", err);
    return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
  }

  if (process.env.OPENROUTER_API_KEY) {
    generateDisplayName(documentName.trim(), userId, documentType, documentId);
  }

  return NextResponse.json({ ok: true });
}

async function generateDisplayName(
  originalName: string,
  userId: string,
  documentType: string,
  documentId: number,
) {
  try {
    const { content } = await chatCompletion(
      [
        {
          role: "system",
          content: "You rewrite government document titles to be short and clear. Return ONLY the new title, nothing else.",
        },
        {
          role: "user",
          content: `Rewrite this document title in 10 words or less, keeping the key topic:\n\n${originalName}`,
        },
      ],
      { model: "anthropic/claude-3-haiku", temperature: 0.3, maxTokens: 40 },
    );
    const displayName = content.trim().replace(/^["']|["']$/g, "");
    if (displayName) {
      await db
        .update(savedDocuments)
        .set({ displayName })
        .where(
          and(
            eq(savedDocuments.userId, userId),
            eq(savedDocuments.documentType, documentType),
            eq(savedDocuments.documentId, documentId),
          ),
        );
    }
  } catch (err) {
    console.error("Failed to generate display name:", err);
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in" },
      { status: 401 },
    );
  }

  let body: { documentType?: string; documentId?: number; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { documentType, documentId, displayName } = body;

  if (
    (documentType !== "file" && documentType !== "attachment") ||
    typeof documentId !== "number" || documentId <= 0 ||
    typeof displayName !== "string"
  ) {
    return NextResponse.json(
      { error: "documentType, documentId, and displayName are required" },
      { status: 400 },
    );
  }

  try {
    await db
      .update(savedDocuments)
      .set({ displayName: displayName.trim() || null })
      .where(
        and(
          eq(savedDocuments.userId, session.user.id),
          eq(savedDocuments.documentType, documentType),
          eq(savedDocuments.documentId, documentId),
        ),
      );
  } catch (err) {
    console.error("Failed to update display name:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to unsave documents" },
      { status: 401 }
    );
  }

  const documentType = request.nextUrl.searchParams.get("documentType");
  const documentIdParam = request.nextUrl.searchParams.get("documentId");
  const documentId = documentIdParam ? parseInt(documentIdParam, 10) : NaN;

  if (
    (documentType !== "file" && documentType !== "attachment") ||
    !Number.isInteger(documentId) || documentId <= 0
  ) {
    return NextResponse.json(
      { error: "documentType and documentId query parameters are required" },
      { status: 400 }
    );
  }

  try {
    await db
      .delete(savedDocuments)
      .where(
        and(
          eq(savedDocuments.userId, session.user.id),
          eq(savedDocuments.documentType, documentType),
          eq(savedDocuments.documentId, documentId)
        )
      );
  } catch (err) {
    console.error("Failed to unsave document:", err);
    return NextResponse.json({ error: "Failed to unsave document" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
