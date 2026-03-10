import { db, events } from '@/lib/db';
import { and, gte, lte, eq, desc, asc } from 'drizzle-orm';

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

function getWeekOfMonth(date: Date): number {
  // Week of month (1-based): which occurrence of this weekday in the month
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

function detectPattern(dates: Date[]): string | null {
  if (dates.length < 3) return null;

  // Count occurrences of each (weekday, week-of-month) pair
  const patternCounts: Record<string, number> = {};
  for (const date of dates) {
    const weekday = date.getDay();
    const week = getWeekOfMonth(date);
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

function toLocalDate(dt: Date): Date {
  // Convert UTC timestamp to Denver local date for day-of-week analysis
  const localStr = dt.toLocaleString('en-US', { timeZone: DENVER_TZ });
  return new Date(localStr);
}

export async function computeCommitteeStats(categoryName: string): Promise<CommitteeStats> {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

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

  // Frequency pattern — use past events (local dates for weekday accuracy)
  const pastDates = pastEvents.map(e => toLocalDate(new Date(e.startDateTime)));
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
