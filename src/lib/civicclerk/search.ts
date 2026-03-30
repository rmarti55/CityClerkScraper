import { parseEventStartDateTime, getEventDateKeyInDenver } from '../datetime';
import type { CivicEvent, DocumentSearchResult, MatchingFile, MatchingItem } from '../types';
import type { SearchFileModel, PublicSearchResultRaw } from './types';
import { API_BASE, getHeaders, stripHighlight } from './api';

/**
 * Search meeting documents via Civic Clerk API (GET /v1/Search?search=).
 * Returns events with matching files and agenda items, including highlighted snippets.
 */
export async function searchCivicClerk(query: string): Promise<DocumentSearchResult[]> {
  const trimmed = query?.trim();
  if (!trimmed) return [];

  const url = `${API_BASE}/Search?${new URLSearchParams({ search: trimmed })}`;
  const response = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 300 },
  });
  if (!response.ok) {
    throw new Error(`Civic Clerk Search failed: ${response.status}`);
  }
  const data: { value?: PublicSearchResultRaw[] } = await response.json();
  const rawResults = data.value ?? [];

  const results: DocumentSearchResult[] = rawResults.map((row) => {
    const ev = row.event;
    const meetingDate = ev.meetingDate ?? '';
    const dateStr = meetingDate
      ? getEventDateKeyInDenver(parseEventStartDateTime(meetingDate).toISOString())
      : '';
    const loc = ev.eventLocation;
    const publishedFiles = ev.publishedFiles ?? [];

    const event: CivicEvent = {
      id: ev.id,
      eventName: stripHighlight(ev.name ?? ''),
      eventDescription: '',
      eventDate: dateStr,
      startDateTime: meetingDate ? parseEventStartDateTime(meetingDate).toISOString() : '',
      agendaId: null,
      agendaName: ev.categoryName ?? '',
      categoryName: ev.categoryName ?? '',
      isPublished: '',
      venueName: loc?.address1 ?? undefined,
      venueAddress: [loc?.address1, loc?.address2].filter(Boolean).join(', ') || undefined,
      venueCity: loc?.city?.trim(),
      venueState: loc?.state,
      venueZip: loc?.zipCode,
      fileCount: publishedFiles.length,
    };

    const matchingFiles: MatchingFile[] = [];
    const seenFileKeys = new Set<string>();

    function addFile(f: SearchFileModel, snippets?: string[]) {
      const key = `${f.fileId ?? f.id ?? 0}-${f.name}`;
      if (seenFileKeys.has(key)) return;
      seenFileKeys.add(key);
      const fromPub = publishedFiles.find((p) => p.name === f.name);
      matchingFiles.push({
        fileId: f.fileId ?? fromPub?.fileId ?? (f.id as number) ?? 0,
        name: stripHighlight(f.name),
        type: f.type ?? fromPub?.type ?? 'File',
        url: f.type !== 'agenda files' ? fromPub?.url : undefined,
        highlightedName: f.name?.includes('<mark') ? f.name : undefined,
        snippets: snippets ?? (Array.isArray(f.fileContent) ? f.fileContent : undefined),
      });
    }

    (row.agendaFiles ?? []).forEach((f) => addFile(f, f.fileContent));
    (row.attachments ?? []).forEach((f) => addFile(f, f.fileContent));

    const matchingItems: MatchingItem[] = (row.items ?? []).map((it) => ({
      id: it.id ?? 0,
      name: stripHighlight(it.name ?? it.agendaObjectItemName ?? ''),
      description: it.agendaObjectItemDescription ?? undefined,
      highlightedName: it.name?.includes('<mark') ? it.name : (it.agendaObjectItemName?.includes('<mark') ? it.agendaObjectItemName : undefined),
    }));

    const totalInEvent = matchingFiles.length + matchingItems.length;

    return { event, matchingFiles, matchingItems, totalInEvent };
  });

  return results;
}

/**
 * Search files and agenda items locally using Postgres full-text search.
 * Replaces searchCivicClerk for the Documents tab with proper phrase matching.
 * Returns events grouped with their matching files and agenda items.
 */
export async function searchDocumentsLocal(query: string): Promise<DocumentSearchResult[]> {
  const trimmed = query?.trim();
  if (!trimmed) return [];

  const maxResults = 200;

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);
    const { parseSearchQuery, buildRankQuery } = await import('../search/parse-query');
    const parsed = parseSearchQuery(trimmed);

    if (!parsed.hasTerms) return [];

    const tsqueryExpr = parsed.tsqueryExpr;
    const rankQuery = buildRankQuery(trimmed);

    const execSql = (q: string) => sql.query(q, []) as Promise<Record<string, unknown>[]>;

    const searchSql = `
      WITH file_matches AS (
        SELECT
          f.id as file_id, f.name, f.type, f.event_id,
          ts_rank(f.search_vector, ${rankQuery}) as rank
        FROM files f
        WHERE f.search_vector @@ ${tsqueryExpr}
      ),
      item_matches AS (
        SELECT
          ai.id, ai.item_name, ai.item_description, ai.event_id,
          ts_rank(ai.search_vector, ${rankQuery}) as rank
        FROM agenda_items ai
        WHERE ai.search_vector @@ ${tsqueryExpr}
      ),
      matched_event_ids AS (
        SELECT event_id FROM file_matches
        UNION
        SELECT event_id FROM item_matches
      ),
      events_data AS (
        SELECT
          e.id, e.event_name, e.event_description, e.event_date, e.start_date_time,
          e.agenda_id, e.agenda_name, e.category_name, e.is_published,
          e.venue_name, e.venue_address, e.venue_city, e.venue_state, e.venue_zip, e.file_count
        FROM events e
        WHERE e.id IN (SELECT event_id FROM matched_event_ids)
      )
      SELECT
        ed.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'file_id', fm.file_id,
            'name', fm.name,
            'type', fm.type,
            'rank', fm.rank
          ) ORDER BY fm.rank DESC)
          FROM file_matches fm WHERE fm.event_id = ed.id),
          '[]'::json
        ) as matching_files,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', im.id,
            'item_name', im.item_name,
            'item_description', im.item_description,
            'rank', im.rank
          ) ORDER BY im.rank DESC)
          FROM item_matches im WHERE im.event_id = ed.id),
          '[]'::json
        ) as matching_items,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'file_id', af.id,
            'name', af.name,
            'type', af.type
          ) ORDER BY af.id)
          FROM files af WHERE af.event_id = ed.id),
          '[]'::json
        ) as event_files,
        COALESCE(
          (SELECT MAX(fm.rank) FROM file_matches fm WHERE fm.event_id = ed.id), 0
        ) + COALESCE(
          (SELECT MAX(im.rank) FROM item_matches im WHERE im.event_id = ed.id), 0
        ) as best_rank
      FROM events_data ed
      ORDER BY best_rank DESC, ed.start_date_time DESC
      LIMIT ${maxResults}
    `;

    const rows = await execSql(searchSql);

    return rows.map((row) => {
      const event = mapRowToEvent(row);

      const rawFiles = (typeof row.matching_files === 'string'
        ? JSON.parse(row.matching_files)
        : row.matching_files) as Array<{ file_id: number; name: string; type: string; rank: number }>;

      const rawItems = (typeof row.matching_items === 'string'
        ? JSON.parse(row.matching_items)
        : row.matching_items) as Array<{ id: number; item_name: string; item_description: string | null; rank: number }>;

      const matchingFiles: MatchingFile[] = rawFiles.map((f) => ({
        fileId: f.file_id,
        name: f.name,
        type: f.type || 'File',
      }));

      const matchingItems: MatchingItem[] = rawItems.map((it) => ({
        id: it.id,
        name: it.item_name,
        description: it.item_description,
      }));

      const rawEventFiles = (typeof row.event_files === 'string'
        ? JSON.parse(row.event_files)
        : row.event_files) as Array<{ file_id: number; name: string; type: string }>;

      const eventFiles: MatchingFile[] = rawEventFiles.map((f) => ({
        fileId: f.file_id,
        name: f.name,
        type: f.type || 'File',
      }));

      return {
        event,
        matchingFiles,
        matchingItems,
        totalInEvent: matchingFiles.length + matchingItems.length,
        eventFiles,
      };
    });
  } catch (error) {
    console.error('Document search query failed:', error);
    throw new Error('Failed to search documents');
  }
}

/**
 * Search events across all time periods using Postgres full-text search.
 * Searches both the events table and agenda_items table, with relevance ranking.
 * Supports Google-style query syntax: "exact phrases", -exclude, OR.
 *
 * Results are sorted by relevance (ts_rank) with agenda item title matches
 * scoring highest. When only a category filter is provided (no text query),
 * results are sorted by date descending.
 *
 * @param query - Search term to match against event fields and agenda items (optional if categoryName provided)
 * @param categoryName - Optional category to filter results by
 */
export async function searchEvents(
  query: string,
  categoryName?: string
): Promise<{ events: CivicEvent[]; total: number }> {
  const maxResults = 200;

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);

    // Category-only filter (no text search) — return by date
    if (!query && categoryName) {
      const countResult = await sql`
        SELECT COUNT(*) as total FROM events WHERE category_name = ${categoryName}
      `;
      const results = await sql`
        SELECT id, event_name, event_description, event_date, start_date_time,
               agenda_id, agenda_name, category_name, is_published,
               venue_name, venue_address, venue_city, venue_state, venue_zip, file_count
        FROM events
        WHERE category_name = ${categoryName}
        ORDER BY start_date_time DESC
        LIMIT ${maxResults}
      `;
      return {
        total: parseInt(countResult[0]?.total || '0', 10),
        events: results.map(mapRowToEvent),
      };
    }

    if (!query) {
      return { events: [], total: 0 };
    }

    const { parseSearchQuery, buildRankQuery } = await import('../search/parse-query');
    const parsed = parseSearchQuery(query);

    if (!parsed.hasTerms) {
      return { events: [], total: 0 };
    }

    const tsqueryExpr = parsed.tsqueryExpr;
    const rankQuery = buildRankQuery(query);

    // Build category filter clause
    const categoryFilter = categoryName
      ? `AND e.category_name = '${categoryName.replace(/'/g, "''")}'`
      : '';

    // Unified search: events + agenda_items, deduplicated by event, ranked by relevance.
    // Agenda item title matches (weight A) rank highest.
    const searchSql = `
      WITH event_matches AS (
        SELECT
          e.id, e.event_name, e.event_description, e.event_date, e.start_date_time,
          e.agenda_id, e.agenda_name, e.category_name, e.is_published,
          e.venue_name, e.venue_address, e.venue_city, e.venue_state, e.venue_zip, e.file_count,
          NULL::text as matching_agenda_item,
          ts_rank(e.search_vector, ${rankQuery}) as rank
        FROM events e
        WHERE e.search_vector @@ ${tsqueryExpr} ${categoryFilter}
      ),
      agenda_matches AS (
        SELECT
          e.id, e.event_name, e.event_description, e.event_date, e.start_date_time,
          e.agenda_id, e.agenda_name, e.category_name, e.is_published,
          e.venue_name, e.venue_address, e.venue_city, e.venue_state, e.venue_zip, e.file_count,
          ai.item_name as matching_agenda_item,
          ts_rank(ai.search_vector, ${rankQuery}) * 2.0 as rank
        FROM agenda_items ai
        JOIN events e ON e.id = ai.event_id
        WHERE ai.search_vector @@ ${tsqueryExpr} ${categoryFilter}
      ),
      combined AS (
        SELECT * FROM event_matches
        UNION ALL
        SELECT * FROM agenda_matches
      ),
      ranked AS (
        SELECT DISTINCT ON (id)
          id, event_name, event_description, event_date, start_date_time,
          agenda_id, agenda_name, category_name, is_published,
          venue_name, venue_address, venue_city, venue_state, venue_zip, file_count,
          matching_agenda_item, rank
        FROM combined
        ORDER BY id, rank DESC
      )
      SELECT * FROM ranked
      ORDER BY rank DESC, start_date_time DESC
      LIMIT ${maxResults}
    `;

    const execSql = (query: string) => sql.query(query, []) as Promise<Record<string, unknown>[]>;

    const results = await execSql(searchSql);

    const countSql = `
      SELECT COUNT(DISTINCT id) as total FROM (
        SELECT e.id FROM events e
        WHERE e.search_vector @@ ${tsqueryExpr} ${categoryFilter}
        UNION
        SELECT e.id FROM agenda_items ai JOIN events e ON e.id = ai.event_id
        WHERE ai.search_vector @@ ${tsqueryExpr} ${categoryFilter}
      ) sub
    `;
    const countResult = await execSql(countSql);
    const total = parseInt(String(countResult[0]?.total ?? '0'), 10);

    const events: CivicEvent[] = results.map((row: Record<string, unknown>) => ({
      ...mapRowToEvent(row),
      matchingAgendaItem: (row.matching_agenda_item as string) || undefined,
      searchRank: row.rank as number | undefined,
    }));

    return { events, total };
  } catch (error) {
    console.error('Search query failed:', error);
    throw new Error('Failed to search events');
  }
}

function mapRowToEvent(row: Record<string, unknown>): CivicEvent {
  const rawTs = row.start_date_time;
  let isoDateTime: string;
  if (rawTs instanceof Date) {
    isoDateTime = rawTs.toISOString();
  } else {
    const str = String(rawTs).trim();
    const d = new Date(str.includes('T') ? str : str.replace(' ', 'T') + 'Z');
    isoDateTime = isNaN(d.getTime()) ? str : d.toISOString();
  }

  return {
    id: row.id as number,
    eventName: row.event_name as string,
    eventDescription: (row.event_description as string) || '',
    eventDate: row.event_date as string,
    startDateTime: isoDateTime,
    agendaId: row.agenda_id as number | null,
    agendaName: (row.agenda_name as string) || '',
    categoryName: (row.category_name as string) || '',
    isPublished: (row.is_published as string) || '',
    venueName: (row.venue_name as string) || undefined,
    venueAddress: (row.venue_address as string) || undefined,
    venueCity: (row.venue_city as string) || undefined,
    venueState: (row.venue_state as string) || undefined,
    venueZip: (row.venue_zip as string) || undefined,
    fileCount: (row.file_count as number) || 0,
  };
}
