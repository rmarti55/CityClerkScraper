import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/events/by-category?categoryId=26&page=1&limit=20
 * Returns events filtered by category with pagination
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const categoryId = searchParams.get('categoryId');
  const categoryName = searchParams.get('categoryName');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // Validate - need either categoryId or categoryName
  if (!categoryId && !categoryName) {
    return NextResponse.json(
      { error: 'categoryId or categoryName is required' },
      { status: 400 }
    );
  }

  // Validate pagination
  if (page < 1 || limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: 'Invalid pagination parameters' },
      { status: 400 }
    );
  }

  try {
    const offset = (page - 1) * limit;

    // Query by categoryName (more reliable since that's what we store)
    const whereClause = categoryName 
      ? eq(events.categoryName, categoryName)
      : undefined;

    if (!whereClause) {
      return NextResponse.json(
        { error: 'categoryName is required for filtering' },
        { status: 400 }
      );
    }

    // Get total count
    const countResult = await db
      .select()
      .from(events)
      .where(whereClause);
    
    const total = countResult.length;

    // Get paginated results
    const results = await db
      .select()
      .from(events)
      .where(whereClause)
      .orderBy(desc(events.startDateTime))
      .limit(limit)
      .offset(offset);

    // Map to CivicEvent format
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

    return NextResponse.json({
      events: mappedEvents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Category filter API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events by category' },
      { status: 500 }
    );
  }
}
