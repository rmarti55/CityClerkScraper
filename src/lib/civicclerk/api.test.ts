import { describe, it, expect } from 'vitest';
import {
  normalizeApiEvent,
  mergeAndDedupeFileLists,
  isFebruary2026,
  isRangeInPast,
  stripHighlight,
} from './api';
import type { RawApiEvent } from './types';

describe('normalizeApiEvent', () => {
  const base: Omit<RawApiEvent, 'venueName' | 'venueAddress' | 'venueCity' | 'venueState' | 'venueZip' | 'eventLocation'> = {
    id: 1,
    eventName: 'Test Meeting',
    eventDescription: 'Desc',
    eventDate: '2026-01-15',
    startDateTime: '2026-01-15T17:00:00Z',
    agendaId: null,
    agendaName: '',
    categoryName: 'Governing Body',
    isPublished: 'true',
  };

  it('uses flat venue fields when present', () => {
    const raw: RawApiEvent = {
      ...base,
      venueName: 'City Hall',
      venueAddress: '123 Main St',
      venueCity: 'Santa Fe',
      venueState: 'NM',
      venueZip: '87501',
    };
    const result = normalizeApiEvent(raw);
    expect(result.venueName).toBe('City Hall');
    expect(result.venueAddress).toBe('123 Main St');
    expect(result.venueCity).toBe('Santa Fe');
    expect(result.venueState).toBe('NM');
    expect(result.venueZip).toBe('87501');
  });

  it('falls back to eventLocation when flat fields are absent', () => {
    const raw: RawApiEvent = {
      ...base,
      eventLocation: {
        address1: 'City Hall',
        address2: '123 Main St',
        city: 'Santa Fe',
        state: 'NM',
        zipCode: '87501',
      },
    };
    const result = normalizeApiEvent(raw);
    expect(result.venueName).toBe('City Hall');
    expect(result.venueAddress).toBe('123 Main St');
    expect(result.venueCity).toBe('Santa Fe');
  });

  it('prefers flat fields over eventLocation when both present', () => {
    const raw: RawApiEvent = {
      ...base,
      venueName: 'Flat Name',
      eventLocation: { address1: 'Location Name' },
    };
    const result = normalizeApiEvent(raw);
    expect(result.venueName).toBe('Flat Name');
  });

  it('returns undefined for empty string venue fields', () => {
    const raw: RawApiEvent = {
      ...base,
      venueName: '',
      venueAddress: '',
    };
    const result = normalizeApiEvent(raw);
    expect(result.venueName).toBeUndefined();
    expect(result.venueAddress).toBeUndefined();
  });

  it('defaults eventDescription to empty string when undefined', () => {
    const raw: RawApiEvent = {
      ...base,
      eventDescription: undefined as unknown as string,
    };
    const result = normalizeApiEvent(raw);
    expect(result.eventDescription).toBe('');
  });

  it('preserves all non-venue fields', () => {
    const raw: RawApiEvent = { ...base };
    const result = normalizeApiEvent(raw);
    expect(result.id).toBe(1);
    expect(result.eventName).toBe('Test Meeting');
    expect(result.categoryName).toBe('Governing Body');
    expect(result.startDateTime).toBe('2026-01-15T17:00:00Z');
  });
});

describe('mergeAndDedupeFileLists', () => {
  const file = (id: number, name: string) => ({
    fileId: id, name, type: 'Agenda', url: `url-${id}`, publishOn: '', fileType: 0,
  });

  it('deduplicates by fileId, meeting files win', () => {
    const meeting = [file(1, 'A-meeting')];
    const event = [file(1, 'A-event'), file(2, 'B')];
    const result = mergeAndDedupeFileLists(meeting, event);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('A-meeting');
    expect(result[1].name).toBe('B');
  });

  it('returns empty array for empty inputs', () => {
    expect(mergeAndDedupeFileLists([], [])).toEqual([]);
  });

  it('handles meeting-only files', () => {
    const result = mergeAndDedupeFileLists([file(1, 'A')], []);
    expect(result).toHaveLength(1);
  });

  it('handles event-only files', () => {
    const result = mergeAndDedupeFileLists([], [file(1, 'A')]);
    expect(result).toHaveLength(1);
  });
});

describe('isFebruary2026', () => {
  it('returns true for Feb 1, 2026', () => {
    expect(isFebruary2026(new Date('2026-02-01T00:00:00Z'))).toBe(true);
  });
  it('returns true for Feb 28, 2026', () => {
    expect(isFebruary2026(new Date('2026-02-28T23:59:59Z'))).toBe(true);
  });
  it('returns false for Jan 2026', () => {
    expect(isFebruary2026(new Date('2026-01-15T00:00:00Z'))).toBe(false);
  });
  it('returns false for Mar 2026', () => {
    expect(isFebruary2026(new Date('2026-03-01T00:00:00Z'))).toBe(false);
  });
  it('returns false for Feb 2025', () => {
    expect(isFebruary2026(new Date('2025-02-15T00:00:00Z'))).toBe(false);
  });
});

describe('isRangeInPast', () => {
  it('returns true for a date well in the past', () => {
    expect(isRangeInPast('2020-01-01')).toBe(true);
  });
  it('returns false for a date in the future', () => {
    expect(isRangeInPast('2030-01-01')).toBe(false);
  });
});

describe('stripHighlight', () => {
  it('strips <mark> tags with class', () => {
    expect(stripHighlight('<mark class="highlight">hello</mark> world')).toBe('hello world');
  });
  it('strips plain <mark> tags', () => {
    expect(stripHighlight('<mark>hello</mark> world')).toBe('hello world');
  });
  it('handles multiple marks', () => {
    expect(stripHighlight('<mark>a</mark> and <mark>b</mark>')).toBe('a and b');
  });
  it('returns plain string unchanged', () => {
    expect(stripHighlight('no marks here')).toBe('no marks here');
  });
  it('handles empty string', () => {
    expect(stripHighlight('')).toBe('');
  });
});
