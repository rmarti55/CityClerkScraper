import { db, events } from '@/lib/db';
import { and, gte, lte, eq, desc, asc } from 'drizzle-orm';
import { DateTime } from 'luxon';

const DENVER_TZ = 'America/Denver';

export interface CommitteeStats {
  frequencyPattern: string | null;   // e.g. "2nd & 4th Wednesday"
  meetingTypeCounts: Record<string, number>; // e.g. { "Regular Session": 8, "Special Meeting": 1 }
  lastMeeting: { date: string; name: string } | null;
  nextMeeting: { date: string; name: string } | null;
  totalMeetingsThisYear: number;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function detectPattern(dates: Date[]): string | null {
  if (dates.length < 3) return null;

  const patternCounts: Record<string, number> = {};
  for (const date of dates) {
    const weekday = getDenverWeekday(date);
    const dayOfMonth = getDenverDayOfMonth(date);
    const week = Math.ceil(dayOfMonth / 7);
    const key = `${week}|${weekday}`;
    patternCounts[key] = (patternCounts[key] ?? 0) + 1;
  }

  // Keep patterns that appear in >40% of meetings (handles 2x/month bodies)
  const threshold = dates.length * 0.4;
  const dominant = Object.entries(patternCounts)
    .filter(([, count]) => count >= threshold)
    .sort(([keyA], [keyB]) => {
      const [weekA] = keyA.split('|').map(Number);
      const [weekB] = keyB.split('|').map(Number);
      return weekA - weekB;
    });

  if (dominant.length === 0) return null;

  const labels = dominant.map(([key]) => {
    const [week, weekday] = key.split('|').map(Number);
    return `${ORDINALS[week - 1]} ${DAYS[weekday]}`;
  });

  return labels.join(' & ');
}

function classifyMeetingType(eventName: string): string {
  const lower = eventName.toLowerCase();
  if (lower.includes('special')) return 'Special Meeting';
  if (lower.includes('study')) return 'Study Session';
  if (lower.includes('work session') || lower.includes('workshop')) return 'Work Session';
  if (lower.includes('emergency')) return 'Emergency Meeting';
  if (lower.includes('joint')) return 'Joint Meeting';
  if (lower.includes('regular') || lower.includes('regular meeting') || lower.includes('regular session')) return 'Regular Session';
  return 'Regular Session';
}

function getDenverWeekday(dt: Date): number {
  return DateTime.fromJSDate(dt, { zone: DENVER_TZ }).weekday % 7;
}

function getDenverDayOfMonth(dt: Date): number {
  return DateTime.fromJSDate(dt, { zone: DENVER_TZ }).day;
}

export async function computeCommitteeStats(categoryName: string): Promise<CommitteeStats> {
  const nowDenver = DateTime.now().setZone(DENVER_TZ);
  const now = nowDenver.toJSDate();
  const oneYearAgo = nowDenver.minus({ years: 1 }).toJSDate();
  const startOfYear = nowDenver.startOf('year').toJSDate();

  // Fetch all events for this committee in the past year + upcoming
  const allEvents = await db
    .select({
      id: events.id,
      eventName: events.eventName,
      startDateTime: events.startDateTime,
    })
    .from(events)
    .where(
      and(
        eq(events.categoryName, categoryName),
        gte(events.startDateTime, oneYearAgo)
      )
    )
    .orderBy(asc(events.startDateTime));

  // Split into past and future
  const pastEvents = allEvents.filter(e => new Date(e.startDateTime) < now);
  const futureEvents = allEvents.filter(e => new Date(e.startDateTime) >= now);

  // Meeting type counts (past only)
  const meetingTypeCounts: Record<string, number> = {};
  for (const e of pastEvents) {
    const type = classifyMeetingType(e.eventName);
    meetingTypeCounts[type] = (meetingTypeCounts[type] ?? 0) + 1;
  }

  const pastDates = pastEvents.map(e => new Date(e.startDateTime));
  const frequencyPattern = detectPattern(pastDates);

  // Last meeting
  const lastEvent = pastEvents[pastEvents.length - 1] ?? null;
  const lastMeeting = lastEvent
    ? {
        date: new Date(lastEvent.startDateTime).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: DENVER_TZ,
        }),
        name: lastEvent.eventName,
      }
    : null;

  // Next meeting
  const nextEvent = futureEvents[0] ?? null;
  const nextMeeting = nextEvent
    ? {
        date: new Date(nextEvent.startDateTime).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: DENVER_TZ,
        }),
        name: nextEvent.eventName,
      }
    : null;

  // Total this calendar year (past only)
  const thisYearEvents = pastEvents.filter(
    e => new Date(e.startDateTime) >= startOfYear
  );

  return {
    frequencyPattern,
    meetingTypeCounts,
    lastMeeting,
    nextMeeting,
    totalMeetingsThisYear: thisYearEvents.length,
  };
}
