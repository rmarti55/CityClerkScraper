import { NextRequest, NextResponse } from 'next/server';
import { db, committeeMembers } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { getCommitteeBySlug } from '@/lib/committees';
import { computeCommitteeStats } from '@/lib/committees/stats';
import { getCommitteeLinks } from '@/lib/committees/links';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/committees/[slug]/overview
 * Returns structured committee overview: meeting stats, member roster, and links.
 * No LLM calls — all data is computed from the DB or static config.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { slug } = await params;

    const committee = getCommitteeBySlug(slug);
    if (!committee) {
      return NextResponse.json({ error: 'Committee not found' }, { status: 404 });
    }

    // Run stats and members queries in parallel
    const [stats, members] = await Promise.all([
      computeCommitteeStats(committee.categoryName),
      db
        .select({
          name: committeeMembers.name,
          role: committeeMembers.role,
          scrapedAt: committeeMembers.scrapedAt,
        })
        .from(committeeMembers)
        .where(eq(committeeMembers.categoryName, committee.categoryName))
        .orderBy(desc(committeeMembers.scrapedAt)),
    ]);

    const links = getCommitteeLinks(slug);

    // Derive scrapedAt from the most recent member row
    const membersScrapedAt =
      members.length > 0 ? members[0].scrapedAt?.toISOString() ?? null : null;

    return NextResponse.json(
      {
        stats,
        members: members.map(m => ({ name: m.name, role: m.role })),
        membersScrapedAt,
        links,
      },
      {
        headers: {
          // Allow CDN/browser cache for 5 minutes; stats are near-real-time from DB
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Committee overview API error:', error);
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}
