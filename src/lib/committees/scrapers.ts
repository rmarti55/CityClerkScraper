import { db, committeeMembers } from '@/lib/db';
import { eq } from 'drizzle-orm';

export interface ScrapedMember {
  name: string;
  role: string;
}

export interface CommitteeScrapeConfig {
  categoryName: string;
  sourceUrl: string;
  scrape: (html: string) => ScrapedMember[];
}

// ============================================================
// Parse strategies per committee
// ============================================================

/**
 * Governing Body: parse the Elected Officials page on santafenm.gov.
 * Matches sidebar links like: href="/elected-officials/mayor-..." or "/elected-officials/councilor-..."
 * to extract current Mayor and Councilors, deduplicating and sorting.
 */
function parseGoverningBodyMembers(html: string): ScrapedMember[] {
  const linkRegex =
    /href="\/elected-officials\/(?:mayor|councilor)-[^/"]+">\s*(Mayor|Councilor)\s+([^<\n]+?)\s*<\/a>/gi;

  const seen = new Set<string>();
  const members: ScrapedMember[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const role = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const name = match[2].trim();
    if (seen.has(name)) continue;
    seen.add(name);
    members.push({ name, role });
  }

  const roleOrder: Record<string, number> = { Mayor: 0, Councilor: 1 };
  members.sort((a, b) => {
    const orderDiff = (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });

  return members;
}

/**
 * Generic table parser for pages where a simple membership table exists.
 * Looks for rows with a member name and optional role column.
 */
function parseGenericMemberTable(html: string): ScrapedMember[] {
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const rows = html.match(rowRegex) ?? [];
  const members: ScrapedMember[] = [];

  for (const row of rows) {
    const cells: string[] = [];
    let match;
    const cellMatcher = new RegExp(cellRegex.source, 'gi');
    while ((match = cellMatcher.exec(row)) !== null) {
      cells.push(match[1].replace(/<[^>]+>/g, '').trim());
    }

    if (cells.length === 0 || !cells[0]) continue;

    const name = cells[0].trim();
    const role = cells[1]?.trim() ?? 'Member';

    // Skip header rows
    if (['name', 'member', 'position', 'title'].includes(name.toLowerCase())) continue;

    members.push({ name, role });
  }

  return members;
}

// ============================================================
// Scraper configuration per committee slug
// ============================================================

export const SCRAPER_CONFIGS: Record<string, CommitteeScrapeConfig> = {
  'governing-body': {
    categoryName: 'Governing Body',
    sourceUrl: 'https://santafenm.gov/elected-officials',
    scrape: parseGoverningBodyMembers,
  },
  'planning-commission': {
    categoryName: 'Planning Commission',
    sourceUrl: 'https://santafenm.gov/boards-commissions-and-committees/planning-commission',
    scrape: parseGenericMemberTable,
  },
  'historic-design-review': {
    categoryName: 'Historic Design Review Board',
    sourceUrl:
      'https://santafenm.gov/boards-commissions-and-committees/historic-design-review-board',
    scrape: parseGenericMemberTable,
  },
};

// ============================================================
// Main scrape + upsert function
// ============================================================

export interface ScrapeResult {
  count: number;
  members: ScrapedMember[];
  sourceUrl: string;
  scrapedAt: string;
}

export async function scrapeCommitteeMembers(slug: string): Promise<ScrapeResult> {
  const config = SCRAPER_CONFIGS[slug];
  if (!config) {
    throw new Error(`No scraper configured for committee slug: ${slug}`);
  }

  const response = await fetch(config.sourceUrl, {
    headers: { 'User-Agent': 'CityClerk Dashboard/1.0 (city information aggregator)' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${config.sourceUrl}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const scraped = config.scrape(html);

  if (scraped.length === 0) {
    throw new Error(`No members found on page for ${slug} — page structure may have changed`);
  }

  const now = new Date();

  // Replace all members for this category (delete + insert is simpler than upsert for a list)
  await db.delete(committeeMembers).where(eq(committeeMembers.categoryName, config.categoryName));

  await db.insert(committeeMembers).values(
    scraped.map(m => ({
      categoryName: config.categoryName,
      name: m.name,
      role: m.role,
      sourceUrl: config.sourceUrl,
      scrapedAt: now,
    }))
  );

  return {
    count: scraped.length,
    members: scraped,
    sourceUrl: config.sourceUrl,
    scrapedAt: now.toISOString(),
  };
}
