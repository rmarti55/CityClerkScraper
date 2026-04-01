/**
 * Backfill YouTube video discovery and transcript extraction.
 * Defaults to 24 months (covers all CivicClerk data back to June 2024).
 * Requires DATABASE_URL and YOUTUBE_API_KEY in .env or .env.local.
 *
 * Usage:
 *   npx tsx scripts/backfill-transcripts.ts              # Discover + extract (24 months)
 *   npx tsx scripts/backfill-transcripts.ts --process    # Also run AI processing
 *   npx tsx scripts/backfill-transcripts.ts --months=6   # Custom lookback window
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

if (!process.env.YOUTUBE_API_KEY) {
  console.error("YOUTUBE_API_KEY is not set. Add it to .env or .env.local in the project root.");
  process.exit(1);
}

async function main() {
  const doProcess = process.argv.includes("--process");

  // Dynamic import after env is loaded
  const { runTranscriptPipeline } = await import("../src/lib/youtube/pipeline");

  const monthsArg = process.argv.find(a => a.startsWith('--months='));
  const monthsBack = monthsArg ? parseInt(monthsArg.split('=')[1], 10) : 24;
  const lookback = new Date();
  lookback.setMonth(lookback.getMonth() - monthsBack);

  console.log(`Starting transcript backfill from ${lookback.toISOString()} (${monthsBack} months)`);
  console.log(`AI processing: ${doProcess ? "enabled" : "disabled (use --process to enable)"}`);
  console.log();

  const result = await runTranscriptPipeline({
    publishedAfter: lookback.toISOString(),
    extractLimit: 50,
    processLimit: doProcess ? 50 : 0,
  });

  console.log("Backfill complete:");
  console.log(`  Videos discovered: ${result.videosDiscovered}`);
  console.log(`  Videos matched to events: ${result.videosMatched}`);
  console.log(`  Transcripts extracted: ${result.transcriptsExtracted}`);
  console.log(`  Transcripts AI-processed: ${result.transcriptsProcessed}`);

  if (result.errors.length > 0) {
    console.log();
    console.log("Errors:");
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
