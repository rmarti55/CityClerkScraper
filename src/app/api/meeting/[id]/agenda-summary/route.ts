import { NextRequest, NextResponse } from 'next/server';
import { getEventById, getMeetingDetails } from '@/lib/civicclerk';
import { generateAgendaSummaries } from '@/lib/llm/agenda-summary';
import { OpenRouterError } from '@/lib/llm/openrouter';
import { db, agendaSummaries } from '@/lib/db';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.agendaId == null) {
      return NextResponse.json({ error: 'No agenda for this event' }, { status: 404 });
    }

    // Check DB cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = await db.select().from(agendaSummaries).where(eq(agendaSummaries.eventId, eventId)).limit(1);
        if (cached.length > 0) {
          const summaries = JSON.parse(cached[0].summaryJson);
          if (Array.isArray(summaries) && summaries.length > 0) {
            return NextResponse.json(
              { summaries },
              {
                headers: {
                  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
                },
              },
            );
          }
        }
      } catch (dbError) {
        console.warn('DB cache read failed for agenda summary:', dbError);
      }
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'AI summaries not configured', configured: false },
        { status: 503 },
      );
    }

    const meetingDetails = await getMeetingDetails(event.agendaId);
    if (!meetingDetails?.items?.length) {
      return NextResponse.json({ summaries: [] });
    }

    const summaries = await generateAgendaSummaries(meetingDetails.items);

    if (summaries.length > 0) {
      try {
        await db.insert(agendaSummaries).values({
          eventId,
          agendaId: event.agendaId,
          summaryJson: JSON.stringify(summaries),
        }).onConflictDoUpdate({
          target: agendaSummaries.eventId,
          set: {
            summaryJson: JSON.stringify(summaries),
            generatedAt: new Date(),
          },
        });
      } catch (dbError) {
        console.warn('Failed to cache agenda summary in DB:', dbError);
      }
    }

    return NextResponse.json(
      { summaries },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (error) {
    if (error instanceof OpenRouterError && error.status === 402) {
      console.warn('Agenda summary skipped: insufficient OpenRouter credits');
      return NextResponse.json(
        { error: 'Insufficient OpenRouter credits', configured: false },
        { status: 503 },
      );
    }
    console.error('Agenda summary API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summaries' },
      { status: 500 },
    );
  }
}
