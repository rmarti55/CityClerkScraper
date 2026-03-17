import { NextRequest, NextResponse } from 'next/server';
import { db, people } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const rows = await db
    .select()
    .from(people)
    .where(eq(people.slug, slug))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}
