import { NextRequest, NextResponse } from 'next/server';
import { searchCivicClerk } from '@/lib/civicclerk';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    const results = await searchCivicClerk(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Document search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search meeting documents' },
      { status: 500 }
    );
  }
}
