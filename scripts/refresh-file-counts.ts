/**
 * One-time script: refresh file_count and file_names for events that have
 * agenda_id set but file_count = 0. Only UPDATEs existing rows (no inserts/deletes).
 * Run after deploying the dashboard attachment-count fix to correct stale DB rows.
 *
 * Requires DATABASE_URL in .env or .env.local (project root).
 *
 * Usage:
 *   npx tsx scripts/refresh-file-counts.ts
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
  const { db, events } = await import("../src/lib/db");
  const { getMeetingDetails } = await import("../src/lib/civicclerk");
  const { and, eq, gt, or, isNull } = await import("drizzle-orm");

  // Events that have an agenda but zero (or null) file count
  const rows = await db
    .select({ id: events.id, agendaId: events.agendaId, eventName: events.eventName })
    .from(events)
    .where(
      and(
        gt(events.agendaId, 0),
        or(eq(events.fileCount, 0), isNull(events.fileCount))
      )
    );

  console.log(`Found ${rows.length} event(s) with agendaId but file_count 0. Refreshing...\n`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (row) => {
        try {
          const meeting = await getMeetingDetails(row.agendaId!);
          const fileCount = meeting?.publishedFiles?.length ?? 0;
          const fileNames = meeting?.publishedFiles?.map((f) => f.name).join(" ") ?? "";
          return { row, fileCount, fileNames, ok: true };
        } catch (err) {
          console.warn(`  Failed eventId=${row.id} agendaId=${row.agendaId} (${row.eventName})`, err);
          return { row, fileCount: 0, fileNames: "", ok: false };
        }
      })
    );

    for (const r of results) {
      if (!r.ok) {
        failed++;
        continue;
      }
      await db
        .update(events)
        .set({
          fileCount: r.fileCount,
          fileNames: r.fileNames,
          cachedAt: new Date(),
        })
        .where(eq(events.id, r.row.id));
      updated++;
      if (r.fileCount > 0) {
        console.log(`  Updated event ${r.row.id} (${r.row.eventName}): fileCount=${r.fileCount}`);
      }
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
