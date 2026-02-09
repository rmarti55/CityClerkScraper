import { NextResponse } from 'next/server';

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

interface CategoryCountResult {
  categoryName: string;
  count: number;
}

/**
 * Fetch all category counts by paginating through the OData groupby results
 */
async function fetchAllCategoryCounts(): Promise<Map<string, number>> {
  const countMap = new Map<string, number>();
  let skip = 0;
  
  while (true) {
    const url = `${API_BASE}/Events?$apply=groupby((categoryName),aggregate($count as count))&$skip=${skip}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch category counts at skip=${skip}`);
      break;
    }
    
    const data = await response.json();
    const counts: CategoryCountResult[] = data.value || [];
    
    if (counts.length === 0) {
      break; // No more results
    }
    
    counts.forEach((c) => {
      countMap.set(c.categoryName, c.count);
    });
    
    skip += counts.length;
    
    // Safety limit to prevent infinite loops
    if (skip > 200) {
      break;
    }
  }
  
  return countMap;
}

/**
 * GET /api/categories
 * Returns all event categories from CivicClerk API with meeting counts
 */
export async function GET() {
  try {
    // Fetch categories and counts in parallel
    const [categoriesRes, countMap] = await Promise.all([
      fetch(`${API_BASE}/EventCategories`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }),
      fetchAllCategoryCounts(),
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
