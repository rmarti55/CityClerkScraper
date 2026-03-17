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
 * Search events across all time periods
 * Returns results sorted by date descending (newest first)
 * Limited to 1000 results max to prevent runaway queries
 *
 * @param query - Search term to match against event fields (optional if categoryName provided)
 * @param categoryName - Optional category to filter results by
 */
export async function searchEvents(
  query: string,
  categoryName?: string
): Promise<{ events: CivicEvent[]; total: number }> {
  const searchPattern = query ? `%${query}%` : null;
  const maxResults = 1000;

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);

    let countResult;
    let results;

    if (searchPattern && categoryName) {
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM events
        WHERE 
          category_name = ${categoryName}
          AND (
            event_name ILIKE ${searchPattern}
            OR category_name ILIKE ${searchPattern}
            OR agenda_name ILIKE ${searchPattern}
            OR             event_description ILIKE ${searchPattern}
            OR venue_name ILIKE ${searchPattern}
            OR file_names ILIKE ${searchPattern}
          )
      `;

      results = await sql`
        SELECT 
          id,
          event_name,
          event_description,
          event_date,
          start_date_time,
          agenda_id,
          agenda_name,
          category_name,
          is_published,
          venue_name,
          venue_address,
          venue_city,
          venue_state,
          venue_zip,
          file_count
        FROM events
        WHERE 
          category_name = ${categoryName}
          AND (
            event_name ILIKE ${searchPattern}
            OR category_name ILIKE ${searchPattern}
            OR agenda_name ILIKE ${searchPattern}
            OR event_description ILIKE ${searchPattern}
            OR venue_name ILIKE ${searchPattern}
            OR file_names ILIKE ${searchPattern}
          )
        ORDER BY start_date_time DESC
        LIMIT ${maxResults}
      `;
    } else if (categoryName) {
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM events
        WHERE category_name = ${categoryName}
      `;

      results = await sql`
        SELECT 
          id,
          event_name,
          event_description,
          event_date,
          start_date_time,
          agenda_id,
          agenda_name,
          category_name,
          is_published,
          venue_name,
          venue_address,
          venue_city,
          venue_state,
          venue_zip,
          file_count
        FROM events
        WHERE category_name = ${categoryName}
        ORDER BY start_date_time DESC
        LIMIT ${maxResults}
      `;
    } else if (searchPattern) {
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM events
        WHERE 
          event_name ILIKE ${searchPattern}
          OR category_name ILIKE ${searchPattern}
          OR agenda_name ILIKE ${searchPattern}
          OR event_description ILIKE ${searchPattern}
          OR venue_name ILIKE ${searchPattern}
          OR file_names ILIKE ${searchPattern}
      `;

      results = await sql`
        SELECT 
          id,
          event_name,
          event_description,
          event_date,
          start_date_time,
          agenda_id,
          agenda_name,
          category_name,
          is_published,
          venue_name,
          venue_address,
          venue_city,
          venue_state,
          venue_zip,
          file_count
        FROM events
        WHERE 
          event_name ILIKE ${searchPattern}
          OR category_name ILIKE ${searchPattern}
          OR agenda_name ILIKE ${searchPattern}
          OR event_description ILIKE ${searchPattern}
          OR venue_name ILIKE ${searchPattern}
          OR file_names ILIKE ${searchPattern}
        ORDER BY start_date_time DESC
        LIMIT ${maxResults}
      `;
    } else {
      return { events: [], total: 0 };
    }

    const total = parseInt(countResult[0]?.total || '0', 10);

    const events: CivicEvent[] = results.map((row: Record<string, unknown>) => {
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
    });

    return { events, total };
  } catch (error) {
    console.error('Search query failed:', error);
    throw new Error('Failed to search events');
  }
}
