import { db, agendaItems } from '../db';
import { eq } from 'drizzle-orm';
import type { MeetingItem } from '../types';

/**
 * Strip HTML tags from agenda item names/descriptions.
 * CivicClerk often wraps content in <span>, <br>, <strong>, etc.
 */
function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface FlatItem {
  outlineNumber: string;
  itemName: string;
  itemDescription: string | null;
}

/**
 * Recursively flatten the nested MeetingItem tree, qualifying outline numbers
 * so child "b." under parent "9." becomes "9.b".
 */
function flattenItems(
  items: MeetingItem[],
  parentOutline?: string
): FlatItem[] {
  const result: FlatItem[] = [];
  for (const item of items) {
    const rawOutline = item.agendaObjectItemOutlineNumber?.trim() || '';
    const outline = parentOutline
      ? `${parentOutline.replace(/\.\s*$/, '')}.${rawOutline.replace(/\.\s*$/, '')}`
      : rawOutline.replace(/\.\s*$/, '');

    const name = stripHtml(item.agendaObjectItemName || '');
    if (name) {
      result.push({
        outlineNumber: outline,
        itemName: name,
        itemDescription: item.agendaObjectItemDescription
          ? stripHtml(item.agendaObjectItemDescription)
          : null,
      });
    }

    if (item.childItems?.length) {
      result.push(...flattenItems(item.childItems, outline));
    }
  }
  return result;
}

/**
 * Cache all agenda items for a meeting in the agenda_items table.
 * Deletes existing items for the event, then inserts fresh ones.
 */
export async function cacheAgendaItems(
  eventId: number,
  agendaId: number,
  items: MeetingItem[]
): Promise<void> {
  const flat = flattenItems(items);
  if (flat.length === 0) return;

  const now = new Date();

  try {
    await db.delete(agendaItems).where(eq(agendaItems.eventId, eventId));

    for (let i = 0; i < flat.length; i += 100) {
      const chunk = flat.slice(i, i + 100);
      await db.insert(agendaItems).values(
        chunk.map((item) => ({
          eventId,
          agendaId,
          outlineNumber: item.outlineNumber,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          cachedAt: now,
        }))
      );
    }
  } catch (error) {
    console.warn(`Failed to cache agenda items for event ${eventId}:`, error);
  }
}

/**
 * Check if agenda items are already cached for a given event.
 */
export async function hasAgendaItemsCached(eventId: number): Promise<boolean> {
  try {
    const result = await db
      .select({ id: agendaItems.id })
      .from(agendaItems)
      .where(eq(agendaItems.eventId, eventId))
      .limit(1);
    return result.length > 0;
  } catch {
    return false;
  }
}
