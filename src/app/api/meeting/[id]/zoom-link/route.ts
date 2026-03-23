import { NextRequest, NextResponse } from "next/server";
import { db, events } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getEventFiles } from "@/lib/civicclerk";
import { extractMeetingLinkFromFile } from "@/lib/zoom-link";

const NO_LINK = "__none__";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const eventId = parseInt(id, 10);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  }

  const [row] = await db
    .select({ zoomLink: events.zoomLink })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (row.zoomLink === NO_LINK) {
    return NextResponse.json({ zoomLink: null });
  }
  if (row.zoomLink) {
    return NextResponse.json({ zoomLink: row.zoomLink });
  }

  const files = await getEventFiles(eventId);

  const agenda = files.find(
    (f) => f.type.toLowerCase() === "agenda",
  ) ?? files.find(
    (f) => f.type.toLowerCase().includes("agenda") && !f.type.toLowerCase().includes("packet"),
  );

  let link: string | null = null;

  if (agenda) {
    link = await extractMeetingLinkFromFile(agenda.fileId);
  }

  if (!link) {
    for (const file of files) {
      if (file === agenda) continue;
      link = await extractMeetingLinkFromFile(file.fileId);
      if (link) break;
    }
  }

  try {
    await db
      .update(events)
      .set({ zoomLink: link ?? NO_LINK })
      .where(eq(events.id, eventId));
  } catch (e) {
    console.warn("Failed to cache zoom link:", e);
  }

  return NextResponse.json({ zoomLink: link });
}
