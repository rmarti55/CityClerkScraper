import { NextResponse } from 'next/server';
import { db, events } from '@/lib/db';
import { count, isNotNull } from 'drizzle-orm';

const API_BASE = "https://santafenm.api.civicclerk.com/v1";

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  meetingCount?: number;
}

interface CivicClerkCategory {
  id: number;
  categoryDesc: string;
  sortOrder: number;
  isPublic: number;
  parentId: number;
}

/**
 * Get per-category event counts from the local DB (same source as /api/events/by-category).
 * Keeps dropdown counts in sync with dashboard "Showing X results".
 */
async function getCategoryCountsFromDB(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      categoryName: events.categoryName,
      meetingCount: count(),
    })
    .from(events)
    .where(isNotNull(events.categoryName))
    .groupBy(events.categoryName);

  const countMap = new Map<string, number>();
  for (const row of rows) {
    if (row.categoryName != null) {
      countMap.set(row.categoryName, Number(row.meetingCount));
    }
  }
  return countMap;
}

/**
 * GET /api/categories
 * Returns event categories from CivicClerk API with meeting counts from local DB.
 * Counts use the same DB as /api/events/by-category so dropdown and dashboard stay in sync.
 */
export async function GET() {
  try {
    // Fetch category list from CivicClerk; counts from DB (single source of truth for list view)
    const [categoriesRes, countMap] = await Promise.all([
      fetch(`${API_BASE}/EventCategories`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 }, // 5 min
      }),
      getCategoryCountsFromDB(),
    ]);

    if (!categoriesRes.ok) {
      throw new Error(`Failed to fetch categories: ${categoriesRes.status}`);
    }

    const categoriesData = await categoriesRes.json();
    const categories: CivicClerkCategory[] = categoriesData.value || [];

    // Map to our format, sorted alphabetically by name
    const result: Category[] = categories
      .filter((c) => c.isPublic === 1) // Only public categories
      .map((c) => ({
        id: c.id,
        name: c.categoryDesc,
        sortOrder: c.sortOrder,
        meetingCount: countMap.get(c.categoryDesc) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      categories: result,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
