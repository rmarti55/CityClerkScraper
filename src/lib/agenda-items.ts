import type { MeetingItem } from "./types";

/**
 * Normalize an outline number for fuzzy matching:
 * strip whitespace, trailing dots, and lowercase.
 */
export function normalizeOutlineNumber(s: string): string {
  return s.trim().replace(/\.+$/, "").toLowerCase();
}

function qualifyOutlineNumber(
  parentOutlineNumber: string | undefined,
  childOutlineNumber: string,
): string {
  if (!parentOutlineNumber) return childOutlineNumber;
  const parentBase = parentOutlineNumber.replace(/\.\s*$/, "");
  return `${parentBase}-${childOutlineNumber}`;
}

/**
 * Recursively collect all items that have at least one published attachment.
 * When flattening child items, the parent's outline number is prepended so
 * e.g. child "b." under parent "6." becomes "6-b." for readability.
 */
export function collectItemsWithAttachments(
  items: MeetingItem[],
  parentOutlineNumber?: string,
): MeetingItem[] {
  const result: MeetingItem[] = [];
  for (const item of items) {
    const qualifiedNumber = qualifyOutlineNumber(
      parentOutlineNumber,
      item.agendaObjectItemOutlineNumber,
    );
    const published = (item.attachmentsList ?? []).filter((a) => a.isPublished);
    if (published.length > 0) {
      result.push({
        ...item,
        agendaObjectItemOutlineNumber: qualifiedNumber,
        attachmentsList: published,
      });
    }
    if (item.childItems?.length) {
      result.push(
        ...collectItemsWithAttachments(
          item.childItems,
          item.agendaObjectItemOutlineNumber,
        ),
      );
    }
  }
  return result;
}
