import { NextRequest, NextResponse } from 'next/server';
import { db, events, files } from '@/lib/db';
import { eq, desc, count, inArray } from 'drizzle-orm';
import { getMeetingDetails } from '@/lib/civicclerk';
import { upsertFiles } from '@/lib/civicclerk/cache';

const FILE_BACKFILL_BATCH = 5;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const categoryName = searchParams.get('categoryName');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  if (!categoryName) {
    return NextResponse.json(
      { error: 'categoryName is required' },
      { status: 400 }
    );
  }

  try {
    const whereClause = eq(events.categoryName, categoryName);

    const [{ value: totalMeetings }] = await db
      .select({ value: count() })
      .from(events)
      .where(whereClause);

    const offset = (page - 1) * limit;

    const meetingRows = await db
      .select({
        id: events.id,
        eventName: events.eventName,
        eventDate: events.eventDate,
        startDateTime: events.startDateTime,
        agendaId: events.agendaId,
        fileCount: events.fileCount,
      })
      .from(events)
      .where(whereClause)
      .orderBy(desc(events.startDateTime))
      .limit(limit)
      .offset(offset);

    const eventIds = meetingRows.map((m) => m.id);

    let fileRows: {
      id: number;
      eventId: number;
      name: string;
      type: string;
      publishOn: string | null;
      fileSize: number | null;
      pageCount: number | null;
    }[] = [];

    if (eventIds.length > 0) {
      fileRows = await db
        .select({
          id: files.id,
          eventId: files.eventId,
          name: files.name,
          type: files.type,
          publishOn: files.publishOn,
          fileSize: files.fileSize,
          pageCount: files.pageCount,
        })
        .from(files)
        .where(inArray(files.eventId, eventIds));
    }

    // Identify meetings with an agenda but no cached files — backfill them
    const eventIdsWithFiles = new Set(fileRows.map((f) => f.eventId));
    const missingFileMeetings = meetingRows.filter(
      (m) => m.agendaId && m.agendaId > 0 && !eventIdsWithFiles.has(m.id)
    );

    if (missingFileMeetings.length > 0) {
      const toFill = missingFileMeetings.slice(0, FILE_BACKFILL_BATCH);
      await Promise.all(
        toFill.map(async (m) => {
          try {
            const meeting = await getMeetingDetails(m.agendaId!);
            if (meeting?.publishedFiles?.length) {
              await upsertFiles(m.id, meeting.publishedFiles);
            }
          } catch {
            // Non-fatal
          }
        })
      );

      // Re-query files after backfill
      if (eventIds.length > 0) {
        fileRows = await db
          .select({
            id: files.id,
            eventId: files.eventId,
            name: files.name,
            type: files.type,
            publishOn: files.publishOn,
            fileSize: files.fileSize,
            pageCount: files.pageCount,
          })
          .from(files)
          .where(inArray(files.eventId, eventIds));
      }
    }

    const filesByEvent = new Map<number, typeof fileRows>();
    for (const f of fileRows) {
      const arr = filesByEvent.get(f.eventId) ?? [];
      arr.push(f);
      filesByEvent.set(f.eventId, arr);
    }

    const meetings = meetingRows.map((m) => ({
      eventId: m.id,
      eventName: m.eventName,
      eventDate: m.eventDate,
      startDateTime: m.startDateTime.toISOString(),
      agendaId: m.agendaId,
      files: (filesByEvent.get(m.id) ?? []).map((f) => ({
        fileId: f.id,
        name: f.name,
        type: f.type,
        publishOn: f.publishOn,
        fileSize: f.fileSize,
        pageCount: f.pageCount,
      })),
    }));

    const totalFiles = fileRows.length;
    const totalPages = Math.ceil(totalMeetings / limit);

    return NextResponse.json(
      { meetings, totalMeetings, totalFiles, page, limit, totalPages },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Committee documents API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch committee documents' },
      { status: 500 }
    );
  }
}
