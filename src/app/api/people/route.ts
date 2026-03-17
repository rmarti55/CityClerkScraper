import { NextRequest, NextResponse } from 'next/server';
import { db, people } from '@/lib/db';
import { eq, ilike, or, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q')?.trim();
  const department = searchParams.get('department')?.trim();

  let rows;

  if (query) {
    const pattern = `%${query}%`;
    rows = await db
      .select()
      .from(people)
      .where(
        or(
          ilike(people.name, pattern),
          ilike(people.title, pattern),
          ilike(people.department, pattern),
          ilike(people.email, pattern),
        )
      )
      .orderBy(asc(people.department), asc(people.name));
  } else if (department) {
    rows = await db
      .select()
      .from(people)
      .where(eq(people.department, department))
      .orderBy(asc(people.name));
  } else {
    rows = await db
      .select()
      .from(people)
      .orderBy(asc(people.department), asc(people.name));
  }

  // Filter to active only
  const active = rows.filter(r => r.isActive !== 'false');

  return NextResponse.json(active);
}
