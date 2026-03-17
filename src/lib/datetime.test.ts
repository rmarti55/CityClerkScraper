import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getTodayInDenver,
  getNowInDenver,
  getEventDateKeyInDenver,
  isEventToday,
  isEventHappeningNow,
  getMeetingTimeStatus,
} from "./datetime";

// ---------------------------------------------------------------------------
// Helpers for simulating getEventsForMonth logic (Bug 5 fix)
// ---------------------------------------------------------------------------
function filterEventsForMonth(
  events: Array<{ startDateTime: string }>,
  year: number,
  month: number
): Array<{ startDateTime: string }> {
  return events.filter((event) => {
    const key = getEventDateKeyInDenver(event.startDateTime);
    const [y, m] = key.split("-").map(Number);
    return y === year && m === month;
  });
}

/**
 * The clock is mocked to 8:30 PM Mountain Standard Time on March 5, 2026.
 * MST = UTC-7, so 8:30 PM MST = 03:30 AM UTC on March 6, 2026.
 *
 * A naive .toISOString().split("T")[0] would return "2026-03-06" (wrong).
 * All helpers should return "2026-03-05" (correct Denver date).
 */
const MOCK_UTC_MS = new Date("2026-03-06T03:30:00.000Z").getTime(); // 8:30 PM MST March 5

describe("Denver timezone helpers (clock mocked to 8:30 PM MST March 5)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("getTodayInDenver() returns 2026-03-05, not the UTC date 2026-03-06", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_UTC_MS);

    const result = getTodayInDenver();
    expect(result).toBe("2026-03-05");

    // Sanity check: prove why this matters — raw UTC would be wrong
    expect(new Date().toISOString().split("T")[0]).toBe("2026-03-06");
  });

  it("getNowInDenver() returns year=2026, month=3 (March), dateKey=2026-03-05", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_UTC_MS);

    const { year, month, dateKey } = getNowInDenver();
    expect(year).toBe(2026);
    expect(month).toBe(3);
    expect(dateKey).toBe("2026-03-05");
  });

  it("getEventDateKeyInDenver() correctly maps UTC string to Denver calendar date", () => {
    // 6 PM Mountain on Feb 24 = 01:00 UTC Feb 25
    expect(getEventDateKeyInDenver("2026-02-25T01:00:00.000Z")).toBe("2026-02-24");

    // 11 PM Mountain on Jan 31 = 06:00 UTC Feb 1 — must NOT bleed into February
    expect(getEventDateKeyInDenver("2026-02-01T06:00:00.000Z")).toBe("2026-01-31");

    // 9 AM Mountain on March 5 = 16:00 UTC March 5 — same day
    expect(getEventDateKeyInDenver("2026-03-05T16:00:00.000Z")).toBe("2026-03-05");
  });
});

// ---------------------------------------------------------------------------
// Bug 6: Initial month — after 5 PM MT on last day of month, UTC is next month
// ---------------------------------------------------------------------------
describe("getNowInDenver() initial month (mocked to last day of month, evening)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns January when it is 11 PM MST Jan 31 (= 6 AM UTC Feb 1)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T06:00:00.000Z").getTime()); // 11 PM MST Jan 31
    const { year, month } = getNowInDenver();
    expect(year).toBe(2026);
    expect(month).toBe(1); // January, not February

    // Confirm the UTC-based approach (the bug pattern) would get it wrong
    const utcMonth = parseInt(new Date().toISOString().slice(5, 7), 10);
    expect(utcMonth).toBe(2); // UTC is already in February
  });
});

// ---------------------------------------------------------------------------
// Bug 3/4: Email formatDate — server-side formatting must use Denver, not UTC
// ---------------------------------------------------------------------------
describe("toLocaleDateString with timeZone:America/Denver (Bugs 3 & 4)", () => {
  it("formats a 4 PM Mountain meeting as '4:00 PM', not '11:00 PM' (UTC)", () => {
    // 4:00 PM MST = 23:00 UTC
    const utcString = "2026-03-05T23:00:00.000Z";
    const formatted = new Date(utcString).toLocaleDateString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Denver",
    });
    expect(formatted).toContain("4:00");
    expect(formatted).not.toContain("11:00");
  });

  it("formats a 4 PM Mountain date as 'Thu, Mar 5', not 'Thu, Mar 6' (UTC)", () => {
    // 4:00 PM MST March 5 = 23:00 UTC March 5 (still same day, but verify)
    const utcString = "2026-03-05T23:00:00.000Z";
    const formatted = new Date(utcString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    });
    expect(formatted).toContain("Mar");
    expect(formatted).toContain("5");

    // 10 PM MST March 5 = 05:00 UTC March 6 — without tz this shows March 6
    const lateUtc = "2026-03-06T05:00:00.000Z";
    const withTz = new Date(lateUtc).toLocaleDateString("en-US", {
      month: "short", day: "numeric", timeZone: "America/Denver",
    });
    const withoutTz = new Date(lateUtc).toLocaleDateString("en-US", {
      month: "short", day: "numeric", timeZone: "UTC",
    });
    expect(withTz).toContain("5");    // Denver: still March 5
    expect(withoutTz).toContain("6"); // UTC: already March 6
  });
});

// ---------------------------------------------------------------------------
// Bug 5: Month filter — evening meetings at month boundaries must not disappear
// ---------------------------------------------------------------------------
describe("getEventsForMonth filter using Denver calendar date (Bug 5)", () => {
  it("includes a Jan 31 11 PM Mountain meeting when filtering for January", () => {
    // 11 PM MST Jan 31 = 2026-02-01T06:00:00Z
    const events = [
      { startDateTime: "2026-02-01T06:00:00.000Z" }, // 11 PM Jan 31 Mountain — should be January
      { startDateTime: "2026-02-10T17:00:00.000Z" }, // 10 AM Feb 10 Mountain — should be February
    ];

    const january = filterEventsForMonth(events, 2026, 1);
    const february = filterEventsForMonth(events, 2026, 2);

    expect(january).toHaveLength(1);
    expect(january[0]!.startDateTime).toBe("2026-02-01T06:00:00.000Z");

    expect(february).toHaveLength(1);
    expect(february[0]!.startDateTime).toBe("2026-02-10T17:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// isEventToday — Denver-safe "today" check
// ---------------------------------------------------------------------------
describe("isEventToday()", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for a meeting today even when UTC has rolled to the next day", () => {
    // Clock: 10 PM MST March 5 = 05:00 UTC March 6
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T05:00:00.000Z").getTime());

    // Meeting at 5 PM MST March 5 = 00:00 UTC March 6
    expect(isEventToday("2026-03-06T00:00:00.000Z")).toBe(true);
  });

  it("returns false for a meeting yesterday", () => {
    // Clock: 9 AM MST March 6 = 16:00 UTC March 6
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T16:00:00.000Z").getTime());

    // Meeting at 5 PM MST March 5 = 00:00 UTC March 6
    expect(isEventToday("2026-03-06T00:00:00.000Z")).toBe(false);
  });

  it("returns false for a meeting tomorrow", () => {
    // Clock: 9 AM MST March 5 = 16:00 UTC March 5
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T16:00:00.000Z").getTime());

    // Meeting at 5 PM MST March 6 = 00:00 UTC March 7
    expect(isEventToday("2026-03-07T00:00:00.000Z")).toBe(false);
  });

  it("returns true for a late-night meeting (11 PM MST) on the correct Denver day", () => {
    // Clock: 11:30 PM MST Jan 31 = 06:30 UTC Feb 1
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T06:30:00.000Z").getTime());

    // Meeting at 11 PM MST Jan 31 = 06:00 UTC Feb 1
    expect(isEventToday("2026-02-01T06:00:00.000Z")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isEventHappeningNow — within the 2-hour assumed duration window
// ---------------------------------------------------------------------------
describe("isEventHappeningNow()", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when current time is at the meeting start", () => {
    // Meeting at 5 PM MST March 5 = 00:00 UTC March 6
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T00:00:00.000Z").getTime());
    expect(isEventHappeningNow("2026-03-06T00:00:00.000Z")).toBe(true);
  });

  it("returns true 1 hour into the meeting", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T01:00:00.000Z").getTime());
    expect(isEventHappeningNow("2026-03-06T00:00:00.000Z")).toBe(true);
  });

  it("returns false exactly at the 2-hour mark (end of assumed duration)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T02:00:00.000Z").getTime());
    expect(isEventHappeningNow("2026-03-06T00:00:00.000Z")).toBe(false);
  });

  it("returns false before the meeting starts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T23:59:59.000Z").getTime());
    expect(isEventHappeningNow("2026-03-06T00:00:00.000Z")).toBe(false);
  });

  it("returns false for a meeting that ended hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T05:00:00.000Z").getTime());
    expect(isEventHappeningNow("2026-03-06T00:00:00.000Z")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getMeetingTimeStatus — all four states
// ---------------------------------------------------------------------------
describe("getMeetingTimeStatus()", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "happening-now" during the meeting window', () => {
    // Clock: 5:30 PM MST March 5 = 00:30 UTC March 6
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T00:30:00.000Z").getTime());

    // Meeting at 5 PM MST March 5 = 00:00 UTC March 6
    expect(getMeetingTimeStatus("2026-03-06T00:00:00.000Z")).toBe("happening-now");
  });

  it('returns "today" for a meeting later today that has not started', () => {
    // Clock: 9 AM MST March 5 = 16:00 UTC March 5
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T16:00:00.000Z").getTime());

    // Meeting at 5 PM MST March 5 = 00:00 UTC March 6
    expect(getMeetingTimeStatus("2026-03-06T00:00:00.000Z")).toBe("today");
  });

  it('returns "past" for a meeting today whose 2h window has passed', () => {
    // Clock: 10 PM MST March 5 = 05:00 UTC March 6
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T05:00:00.000Z").getTime());

    // Meeting at 5 PM MST March 5 = 00:00 UTC March 6 — ended at 7 PM, now 10 PM
    expect(getMeetingTimeStatus("2026-03-06T00:00:00.000Z")).toBe("past");
  });

  it('returns "upcoming" for a meeting on a future date', () => {
    // Clock: 9 AM MST March 5 = 16:00 UTC March 5
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T16:00:00.000Z").getTime());

    // Meeting at 5 PM MST March 10 = 00:00 UTC March 11
    expect(getMeetingTimeStatus("2026-03-11T00:00:00.000Z")).toBe("upcoming");
  });

  it('returns "past" for a meeting on a previous date', () => {
    // Clock: 9 AM MST March 5 = 16:00 UTC March 5
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T16:00:00.000Z").getTime());

    // Meeting at 5 PM MST March 1 = 00:00 UTC March 2
    expect(getMeetingTimeStatus("2026-03-02T00:00:00.000Z")).toBe("past");
  });

  it("handles UTC boundary: 11 PM MST meeting shows as today, not tomorrow", () => {
    // Clock: 8 PM MST Jan 31 = 03:00 UTC Feb 1
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T03:00:00.000Z").getTime());

    // Meeting at 11 PM MST Jan 31 = 06:00 UTC Feb 1
    expect(getMeetingTimeStatus("2026-02-01T06:00:00.000Z")).toBe("today");
  });
});
