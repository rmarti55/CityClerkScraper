import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@/lib/db';
import { eq, desc, count } from 'drizzle-orm';
import { fetchEventsByCategoryFromAPI, getMeetingDetails } from '@/lib/civicclerk';
import { upsertEvent } from '@/lib/civicclerk/cache';

/**
 * Minimum expected events for a well-known committee.
 * If the DB has fewer than this, we assume it's incomplete and backfill
 * from CivicClerk. After the first successful backfill the DB will have
 * the real total and this threshold won't trigger again.
 */
const BACKFILL_THRESHOLD = 20;

/**
 * GET /api/events/by-committee?categoryName=Governing+Body&page=1&limit=20
 *
 * Like /api/events/by-category but smart: if the local DB looks incomplete
 * for this category, backfills from the CivicClerk API first.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const categoryName = searchParams.get('categoryName');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  if (!categoryName) {
    return NextResponse.json(
      { error: 'categoryName is required' },
      { status: 400 }
    );
  }

  try {
    const whereClause = eq(events.categoryName, categoryName);

    // Quick count check — is the DB likely complete for this category?
    const [{ value: dbCount }] = await db
      .select({ value: count() })
      .from(events)
      .where(whereClause);

    if (dbCount < BACKFILL_THRESHOLD) {
      await backfillCategory(categoryName);
    }

    // Re-count after potential backfill
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(events)
      .where(whereClause);

    const offset = (page - 1) * limit;

    const results = await db
      .select()
      .from(events)
      .where(whereClause)
      .orderBy(desc(events.startDateTime))
      .limit(limit)
      .offset(offset);

    const mappedEvents = results.map((e) => ({
      id: e.id,
      eventName: e.eventName,
      eventDescription: e.eventDescription || '',
      eventDate: e.eventDate,
      startDateTime: e.startDateTime.toISOString(),
      agendaId: e.agendaId,
      agendaName: e.agendaName || '',
      categoryName: e.categoryName || '',
      isPublished: e.isPublished || '',
      venueName: e.venueName || undefined,
      venueAddress: e.venueAddress || undefined,
      venueCity: e.venueCity || undefined,
      venueState: e.venueState || undefined,
      venueZip: e.venueZip || undefined,
      fileCount: e.fileCount || 0,
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(
      { events: mappedEvents, total, page, limit, totalPages },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Committee events API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch committee events' },
      { status: 500 }
    );
  }
}

/**
 * Fetch all events for a category from CivicClerk and upsert them into the DB.
 * Also fetches meeting details (file counts) in batches.
 */
async function backfillCategory(categoryName: string): Promise<void> {
  console.log(`Backfilling category: ${categoryName}`);
  const fetched = await fetchEventsByCategoryFromAPI(categoryName);
  console.log(`Fetched ${fetched.length} events for "${categoryName}" from CivicClerk`);

  const batchSize = 5;
  for (let i = 0; i < fetched.length; i += batchSize) {
    const batch = fetched.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (event) => {
        let fileCount = event.fileCount ?? 0;
        let fileNames = event.fileNames ?? '';

        if (event.agendaId) {
          try {
            const meeting = await getMeetingDetails(event.agendaId);
            if (meeting?.publishedFiles) {
              fileCount = meeting.publishedFiles.length;
              fileNames = meeting.publishedFiles.map((f) => f.name).join(' ');
            }
          } catch {
            // Non-fatal — keep defaults
          }
        }

        try {
          await upsertEvent(event, { fileCount, fileNames });
        } catch (err) {
          console.warn(`Failed to upsert event ${event.id}:`, err);
        }
      })
    );
  }
}
