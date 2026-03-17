import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {},
  events: { id: {}, startDateTime: {}, $inferSelect: {} },
  files: { id: {}, eventId: {}, name: {}, type: {}, url: {}, cachedAt: {} },
}));

import { getCacheDuration, isCacheFresh } from './cache';

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

describe('getCacheDuration', () => {
  afterEach(() => vi.useRealTimers());

  it('returns Infinity for events > 30 days old', () => {
    const old = new Date(Date.now() - 31 * ONE_DAY);
    expect(getCacheDuration(old)).toBe(Infinity);
  });

  it('returns 24h for events 7-30 days old', () => {
    const mid = new Date(Date.now() - 15 * ONE_DAY);
    expect(getCacheDuration(mid)).toBe(ONE_DAY);
  });

  it('returns 1h for events < 7 days old', () => {
    const recent = new Date(Date.now() - 3 * ONE_DAY);
    expect(getCacheDuration(recent)).toBe(ONE_HOUR);
  });

  it('returns 1h for future events', () => {
    const future = new Date(Date.now() + 7 * ONE_DAY);
    expect(getCacheDuration(future)).toBe(ONE_HOUR);
  });

  it('returns 24h at exactly 7 days boundary', () => {
    const boundary = new Date(Date.now() - 7.001 * ONE_DAY);
    expect(getCacheDuration(boundary)).toBe(ONE_DAY);
  });

  it('returns Infinity at exactly 30 days boundary', () => {
    const boundary = new Date(Date.now() - 30.001 * ONE_DAY);
    expect(getCacheDuration(boundary)).toBe(Infinity);
  });
});

describe('isCacheFresh', () => {
  it('returns false when cachedAt is null', () => {
    expect(isCacheFresh(null, new Date())).toBe(false);
  });

  it('returns false when hasFileNames is explicitly false', () => {
    expect(isCacheFresh(new Date(), new Date(), false)).toBe(false);
  });

  it('returns true when hasFileNames is undefined (not checked)', () => {
    const recentEvent = new Date(Date.now() - ONE_DAY);
    const cachedAt = new Date(Date.now() - 30 * 60 * 1000);
    expect(isCacheFresh(cachedAt, recentEvent)).toBe(true);
  });

  it('returns true when hasFileNames is true', () => {
    const recentEvent = new Date(Date.now() - ONE_DAY);
    const cachedAt = new Date(Date.now() - 30 * 60 * 1000);
    expect(isCacheFresh(cachedAt, recentEvent, true)).toBe(true);
  });

  it('returns true for old event with any cachedAt (permanent cache)', () => {
    const oldEvent = new Date(Date.now() - 60 * ONE_DAY);
    const cachedAt = new Date(Date.now() - 30 * ONE_DAY);
    expect(isCacheFresh(cachedAt, oldEvent)).toBe(true);
  });

  it('returns true for recent event cached within 1 hour', () => {
    const recentEvent = new Date(Date.now() - ONE_DAY);
    const cachedAt = new Date(Date.now() - 30 * 60 * 1000);
    expect(isCacheFresh(cachedAt, recentEvent)).toBe(true);
  });

  it('returns false for recent event cached > 1 hour ago', () => {
    const recentEvent = new Date(Date.now() - ONE_DAY);
    const cachedAt = new Date(Date.now() - 2 * ONE_HOUR);
    expect(isCacheFresh(cachedAt, recentEvent)).toBe(false);
  });

  it('returns true for mid-age event cached within 24 hours', () => {
    const midEvent = new Date(Date.now() - 15 * ONE_DAY);
    const cachedAt = new Date(Date.now() - 12 * ONE_HOUR);
    expect(isCacheFresh(cachedAt, midEvent)).toBe(true);
  });

  it('returns false for mid-age event cached > 24 hours ago', () => {
    const midEvent = new Date(Date.now() - 15 * ONE_DAY);
    const cachedAt = new Date(Date.now() - 25 * ONE_HOUR);
    expect(isCacheFresh(cachedAt, midEvent)).toBe(false);
  });
});
