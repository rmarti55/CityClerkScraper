import { NextRequest, NextResponse } from 'next/server';
import { searchEvents } from '@/lib/civicclerk';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const categoryName = searchParams.get('categoryName');

  // Validate - need either a search query (2+ chars) or a category filter
  const hasValidQuery = query && query.trim().length >= 2;
  const hasCategory = categoryName && categoryName.trim().length > 0;

  if (!hasValidQuery && !hasCategory) {
    return NextResponse.json(
      { error: 'Search query must be at least 2 characters, or provide a category filter' },
      { status: 400 }
    );
  }

  try {
    const { events, total } = await searchEvents(
      hasValidQuery ? query.trim() : '',
      hasCategory ? categoryName.trim() : undefined
    );
    
    return NextResponse.json({
      events,
      total,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search events' },
      { status: 500 }
    );
  }
}
