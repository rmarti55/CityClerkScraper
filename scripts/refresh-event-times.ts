/**
 * One-time script: refresh start_date_time for all events (or a date range) from the
 * CivicClerk API. Parses times as America/Denver so 4:00 PM is stored correctly.
 * Only UPDATEs existing rows (no inserts/deletes).
 *
 * Requires DATABASE_URL in .env or .env.local (project root).
 *
 * Usage:
 *   npx tsx scripts/refresh-event-times.ts
 *   npx tsx scripts/refresh-event-times.ts --start=2026-02-01 --end=2026-03-01
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
const BATCH_SIZE = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(): { start?: string; end?: string } {
  const start = process.argv.find((a) => a.startsWith("--start="))?.slice("--start=".length);
  const end = process.argv.find((a) => a.startsWith("--end="))?.slice("--end=".length);
  return { start, end };
}

async function main() {
  const { db, events } = await import("../src/lib/db");
  const { fetchEventStartDateTimeFromAPI } = await import("../src/lib/civicclerk");
  const { parseEventStartDateTime } = await import("../src/lib/datetime");
  const { eq, gte, lt, and } = await import("drizzle-orm");

  const { start: startArg, end: endArg } = parseArgs();

  let rows: { id: number; eventName: string }[];
  if (startArg && endArg) {
    rows = await db
      .select({ id: events.id, eventName: events.eventName })
      .from(events)
      .where(
        and(
          gte(events.startDateTime, new Date(startArg)),
          lt(events.startDateTime, new Date(endArg))
        )
      );
    console.log(`Found ${rows.length} event(s) in range ${startArg} to ${endArg}. Refreshing start_date_time...\n`);
  } else {
    rows = await db.select({ id: events.id, eventName: events.eventName }).from(events);
    console.log(`Found ${rows.length} event(s). Refreshing start_date_time...\n`);
  }

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (row) => {
        const raw = await fetchEventStartDateTimeFromAPI(row.id);
        if (raw == null) return { row, date: null, ok: false };
        const date = parseEventStartDateTime(raw);
        if (Number.isNaN(date.getTime())) return { row, date: null, ok: false };
        return { row, date, ok: true };
      })
    );

    for (const r of results) {
      if (!r.ok || r.date == null) {
        failed++;
        console.warn(`  Failed eventId=${r.row.id} (${r.row.eventName}): no startDateTime from API or parse failed`);
        continue;
      }
      await db
        .update(events)
        .set({
          startDateTime: r.date,
          cachedAt: new Date(),
        })
        .where(eq(events.id, r.row.id));
      updated++;
    }

    if (i + BATCH_SIZE < rows.length) {
      await sleep(THROTTLE_MS);
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
