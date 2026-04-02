/**
 * Process a batch of pending transcripts ordered by priority.
 * Usage: npx tsx scripts/process-batch.ts [count]
 * Default: 10
 */

import path from "path";
import { config } from "dotenv";

const projectRoot = path.resolve(process.cwd());
config({ path: path.join(projectRoot, ".env") });
config({ path: path.join(projectRoot, ".env.local") });

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set"); process.exit(1); }
if (!process.env.OPENROUTER_API_KEY) { console.error("OPENROUTER_API_KEY is not set"); process.exit(1); }

async function main() {
  const count = parseInt(process.argv[2] || "10", 10);
  const { processPendingTranscripts } = await import("../src/lib/youtube/pipeline");

  console.log(`Processing up to ${count} transcripts (ordered by priority)...\n`);

  const startTime = Date.now();
  const processed = await processPendingTranscripts(count);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\nDone: ${processed} transcript(s) processed in ${elapsed}s`);
}

main().catch((err) => { console.error("Failed:", err); process.exit(1); });
