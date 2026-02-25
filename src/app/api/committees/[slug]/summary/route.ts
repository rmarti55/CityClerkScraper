import { NextRequest, NextResponse } from 'next/server';
import { db, events, committeeSummaries } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { getCommitteeBySlug } from '@/lib/committees';
import { generateCommitteeSummary } from '@/lib/llm/summary';

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/committees/[slug]/summary
 * Returns the cached LLM summary for a committee, regenerating if stale
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { slug } = await params;
    
    // Validate committee exists
    const committee = getCommitteeBySlug(slug);
    if (!committee) {
      return NextResponse.json(
        { error: 'Committee not found' },
        { status: 404 }
      );
    }

    // Check for force refresh query param
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    // Get the most recent meeting for this committee
    const [latestMeeting] = await db
      .select()
      .from(events)
      .where(eq(events.categoryName, committee.categoryName))
      .orderBy(desc(events.startDateTime))
      .limit(1);

    // Check for cached summary
    const [cachedSummary] = await db
      .select()
      .from(committeeSummaries)
      .where(eq(committeeSummaries.categoryName, committee.categoryName))
      .limit(1);

    // Determine if we need to regenerate
    const now = new Date();
    const needsRegeneration = forceRefresh || !cachedSummary || 
      // Cache is older than 24 hours
      (cachedSummary.generatedAt && 
        now.getTime() - new Date(cachedSummary.generatedAt).getTime() > CACHE_DURATION_MS) ||
      // New meeting since last generation
      (latestMeeting && cachedSummary.lastMeetingId !== latestMeeting.id);

    if (!needsRegeneration && cachedSummary) {
      return NextResponse.json({
        summary: cachedSummary.summary,
        generatedAt: cachedSummary.generatedAt,
        model: cachedSummary.model,
        cached: true,
      });
    }

    // Fetch recent meetings for context
    const recentMeetings = await db
      .select()
      .from(events)
      .where(eq(events.categoryName, committee.categoryName))
      .orderBy(desc(events.startDateTime))
      .limit(10);

    // Check if OpenRouter API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      // Return a placeholder message if no API key
      return NextResponse.json({
        summary: `Welcome to the ${committee.displayName} page. This committee has ${recentMeetings.length} recent meetings. To enable AI-generated summaries, add your OPENROUTER_API_KEY to your environment variables.`,
        generatedAt: now.toISOString(),
        model: 'none',
        cached: false,
        configured: false,
      });
    }

    // Generate new summary
    const { summary, model } = await generateCommitteeSummary(
      committee.displayName,
      recentMeetings
    );

    // Upsert the summary
    if (cachedSummary) {
      await db
        .update(committeeSummaries)
        .set({
          summary,
          generatedAt: now,
          lastMeetingId: latestMeeting?.id || null,
          model,
        })
        .where(eq(committeeSummaries.categoryName, committee.categoryName));
    } else {
      await db
        .insert(committeeSummaries)
        .values({
          categoryName: committee.categoryName,
          summary,
          generatedAt: now,
          lastMeetingId: latestMeeting?.id || null,
          model,
        });
    }

    return NextResponse.json({
      summary,
      generatedAt: now.toISOString(),
      model,
      cached: false,
    });
  } catch (error) {
    console.error('Committee summary API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
