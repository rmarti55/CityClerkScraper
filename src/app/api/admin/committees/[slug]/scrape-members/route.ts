import { NextRequest, NextResponse } from 'next/server';
import { getCommitteeBySlug } from '@/lib/committees';
import { scrapeCommitteeMembers, SCRAPER_CONFIGS } from '@/lib/committees/scrapers';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/admin/committees/[slug]/scrape-members
 * Manually trigger a member roster scrape for a committee.
 * Fetches the configured city website page, parses members, and upserts into DB.
 *
 * Usage:
 *   curl -X POST https://your-app.vercel.app/api/admin/committees/governing-body/scrape-members \
 *     -H "Authorization: Bearer $ADMIN_SECRET"
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  // Simple secret-based auth — set ADMIN_SECRET in env vars
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim();
    if (token !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { slug } = await params;

    const committee = getCommitteeBySlug(slug);
    if (!committee) {
      return NextResponse.json({ error: 'Committee not found' }, { status: 404 });
    }

    if (!SCRAPER_CONFIGS[slug]) {
      return NextResponse.json(
        {
          error: `No scraper configured for "${slug}". Add a config to src/lib/committees/scrapers.ts`,
        },
        { status: 422 }
      );
    }

    const result = await scrapeCommitteeMembers(slug);

    return NextResponse.json({
      success: true,
      slug,
      categoryName: committee.categoryName,
      ...result,
    });
  } catch (error) {
    console.error('Member scrape error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scrape failed' },
      { status: 500 }
    );
  }
}
