/**
 * Backfill agenda items for all cached events that have an agenda_id.
 * Fetches meeting details from CivicClerk and populates the agenda_items table.
 *
 * Requires DATABASE_URL in .env or .env.local (project root).
 *
 * Usage:
 *   npx tsx scripts/backfill-agenda-items.ts           # All events
 *   npx tsx scripts/backfill-agenda-items.ts --probe    # First 10 events only
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

async function main() {
  const { db, events, agendaItems } = await import("../src/lib/db");
  const { getMeetingDetails } = await import("../src/lib/civicclerk/api");
  const { cacheAgendaItems } = await import("../src/lib/civicclerk/agenda-cache");
  const { and, isNotNull, gt } = await import("drizzle-orm");

  const probe = process.argv.includes("--probe");

  // Find events with a real agenda_id (not null or 0)
  const eventsToProcess = await db
    .select({
      id: events.id,
      agendaId: events.agendaId,
      eventName: events.eventName,
    })
    .from(events)
    .where(and(isNotNull(events.agendaId), gt(events.agendaId, 0)))
    .orderBy(events.startDateTime);

  // Filter to only events without cached items
  const existingEventIds = new Set(
    (await db
      .select({ eventId: agendaItems.eventId })
      .from(agendaItems)
      .groupBy(agendaItems.eventId)
    ).map((r) => r.eventId)
  );

  const needsBackfill = eventsToProcess.filter(
    (e) => !existingEventIds.has(e.id)
  );

  const toProcess = probe ? needsBackfill.slice(0, 10) : needsBackfill;

  console.log(
    `Found ${eventsToProcess.length} events with agenda_id, ${needsBackfill.length} need backfill.`
  );
  if (probe) {
    console.log(`Probe mode: processing first ${toProcess.length} only.\n`);
  } else {
    console.log(`Processing ${toProcess.length} events...\n`);
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (event) => {
        try {
          const meeting = await getMeetingDetails(event.agendaId!);
          if (!meeting?.items?.length) {
            skipped++;
            return;
          }
          await cacheAgendaItems(event.id, event.agendaId!, meeting.items);
          success++;
          process.stdout.write(".");
        } catch (err) {
          failed++;
          process.stdout.write("x");
        }
      })
    );

    if (i + BATCH_SIZE < toProcess.length) {
      await sleep(THROTTLE_MS);
    }
  }

  console.log(`\n\nDone.`);
  console.log(
    `Success: ${success}, Skipped (no items): ${skipped}, Failed: ${failed}`
  );
}

main();
