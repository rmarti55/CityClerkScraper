/**
 * Backfill last 5 years of CivicClerk events and meeting details into the database.
 * Requires DATABASE_URL in .env or .env.local (project root).
 *
 * Usage:
 *   npm run backfill           # Full 5-year backfill
 *   npm run backfill:probe     # First month only
 */

import path from "path";
import { config } from "dotenv";

const projectRoot = path.resolve(process.cwd());
config({ path: path.join(projectRoot, ".env") });
config({ path: path.join(projectRoot, ".env.local") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env or .env.local in the project root.");
  process.exit(1);
}

const THROTTLE_MS = 150;
const YEARS_BACK = 5;

function getMonthsToBackfill(probe: boolean): { year: number; month: number }[] {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1; // 1-12
  const startYear = endYear - YEARS_BACK;
  const startMonth = endMonth; // same month, 5 years ago

  const months: { year: number; month: number }[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  if (probe) {
    return months.slice(0, 1);
  }
  return months;
}

function getDateRange(year: number, month: number): { startDate: string; endDate: string } {
  const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`;
  return { startDate, endDate };
}

async function main() {
  const { backfillDateRange } = await import("../src/lib/civicclerk");

  const probe = process.argv.includes("--probe");
  if (probe) {
    console.log("Probe mode: backfilling first month only to gauge volume.\n");
  }

  const months = getMonthsToBackfill(probe);
  console.log(`Backfilling ${months.length} month(s)...\n`);

  let totalEvents = 0;
  let totalMeetingsCalls = 0;

  for (let i = 0; i < months.length; i++) {
    const { year, month } = months[i];
    const { startDate, endDate } = getDateRange(year, month);
    const label = `${year}-${month.toString().padStart(2, "0")}`;
    process.stdout.write(`${label} ... `);
    try {
      const result = await backfillDateRange(startDate, endDate, { throttleMs: THROTTLE_MS });
      totalEvents += result.eventsCount;
      totalMeetingsCalls += result.meetingsCalls;
      console.log(`${result.eventsCount} events, ${result.meetingsCalls} Meetings API calls`);
    } catch (err) {
      console.log("failed");
      console.error(err);
      process.exit(1);
    }
  }

  console.log("\nDone.");
  console.log(`Total: ${totalEvents} events, ${totalMeetingsCalls} Meetings API calls`);
  if (probe && months.length === 1) {
    const extrapolated = totalEvents * (12 * YEARS_BACK);
    console.log(
      `Extrapolated for ${YEARS_BACK} years (~${12 * YEARS_BACK} months): ~${extrapolated} events`
    );
  }
}

main();
