import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {},
  events: { id: {}, startDateTime: {}, $inferSelect: {} },
  files: { id: {}, eventId: {}, name: {}, type: {}, url: {}, cachedAt: {} },
}));

const civicclerk = await import('@/lib/civicclerk');

/**
 * Snapshot of every public export from @/lib/civicclerk.
 * This test is the safety net for the refactor — if any step
 * accidentally drops or renames an export, this fails immediately.
 */
describe('civicclerk public API snapshot', () => {
  const expectedFunctions = [
    'backfillDateRange',
    'fetchEventNameFromAPI',
    'fetchEventStartDateTimeFromAPI',
    'formatEventDate',
    'formatEventTime',
    'getAttachmentFreshUrl',
    'getEventById',
    'getEventFiles',
    'getEvents',
    'getEventsWithFileCounts',
    'getFileDownloadUrl',
    'getFileUrl',
    'getMeetingDetails',
    'refreshEventById',
    'searchCivicClerk',
    'searchEvents',
  ].sort();

  it.each(expectedFunctions)('exports function: %s', (name) => {
    expect(typeof (civicclerk as Record<string, unknown>)[name]).toBe('function');
  });

  it('does not export any unexpected functions', () => {
    const actualFunctions = Object.keys(civicclerk)
      .filter((k) => typeof (civicclerk as Record<string, unknown>)[k] === 'function')
      .sort();
    expect(actualFunctions).toEqual(expectedFunctions);
  });
});
