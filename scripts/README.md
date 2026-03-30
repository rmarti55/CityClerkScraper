# Scripts

CLI and one-off scripts used for data and schema operations.

## backfill-events.ts

**Run:** `npm run backfill` or `npm run backfill:probe`

Backfills historical meeting/event data from the CivicClerk API into the database.

- `npm run backfill` — Full 5-year backfill
- `npm run backfill:probe` — Test with the first month only

After deploying timezone or date fixes, re-run backfill for affected date ranges so existing events get correct `start_date_time`.

## refresh-file-counts.ts

**Run:** `npm run refresh-file-counts`

Refreshes `file_count` and file metadata (e.g. size, PDF page count) for events and files in the database. Use when you need to repopulate or fix file counts without re-fetching full event data.

## migrate-auth.ts

**Run:** `npm run migrate:auth` or `tsx scripts/migrate-auth.ts`

One-off migration from an **old** auth schema to Auth.js (NextAuth v5). Use only if your database already had:

- Integer `users.id` and/or `password_hash` (or missing `email_verified`)

For **new installs**, use Drizzle only: `npx drizzle-kit push`. Do not run `migrate-auth` on a fresh database; the Drizzle migrations (e.g. `0002_add-auth-tables`) define the auth tables.

Loads `.env.local` for `DATABASE_URL`. Ensure the database is reachable before running.

## backfill-agenda-items.ts

**Run:** `tsx scripts/backfill-agenda-items.ts` or `tsx scripts/backfill-agenda-items.ts --probe`

Backfills agenda items for events that have an `agenda_id` but no cached rows in the `agenda_items` table. Fetches meeting details from the CivicClerk API and caches structured agenda items to the database.

- `tsx scripts/backfill-agenda-items.ts` — Process all events missing agenda items
- `tsx scripts/backfill-agenda-items.ts --probe` — Test with the first 10 events only

**Required env vars:** `DATABASE_URL` (in `.env` or `.env.local`).

## backfill-transcripts.ts

**Run:** `npm run backfill:transcripts` or `npm run backfill:transcripts:process`

Discovers YouTube videos from the city's channel, matches them to CivicClerk events, and extracts transcripts from YouTube auto-captions. Covers the last 3 months of uploads.

- `npm run backfill:transcripts` — Discover videos + extract transcripts only
- `npm run backfill:transcripts:process` — Same as above + run AI processing (clean transcript, generate summary, attribute speakers, extract topics). Requires `OPENROUTER_API_KEY`.

**Required env vars:** `DATABASE_URL`, `YOUTUBE_API_KEY` (in `.env` or `.env.local`).

The pipeline:
1. Fetches recent videos from the configured YouTube channel
2. Fuzzy-matches video titles to events by meeting name + date (bigram similarity + date scoring)
3. Stores video metadata and auto-links high-confidence matches (>= 80/100)
4. Extracts YouTube auto-captions for linked videos
5. (With `--process`) Runs AI processing: transcript cleaning, executive summary, speaker attribution, and topic extraction

## refresh-event-times.ts

**Run:** `tsx scripts/refresh-event-times.ts [--start YYYY-MM-DD] [--end YYYY-MM-DD]`

Re-fetches `startDateTime` from the CivicClerk API for existing events and updates the database with correctly parsed Denver-timezone timestamps. Use after deploying timezone fixes to correct legacy rows without re-running a full backfill. Optional `--start`/`--end` flags limit the date range.

## Probe / investigation scripts

These are one-off CLI probes used during development to inspect CivicClerk API behavior. They are not wired into `package.json` scripts — run them directly with `tsx`.

### probe-event-location.ts

**Run:** `tsx scripts/probe-event-location.ts [eventId]`

Inspects the CivicClerk API response for a single event, logging top-level keys, venue fields, and `eventLocation` structure. Defaults to the first event in a fixed date window if no ID is provided.

### probe-event-times.ts

**Run:** `tsx scripts/probe-event-times.ts [startDate] [endDate]`

Fetches events between two dates and prints raw `startDateTime` values from the API for debugging timezone issues.

### probe-search-api.ts

**Run:** `tsx scripts/probe-search-api.ts`

Probes the CivicClerk `/v1/Search` endpoint with several query styles and OData filter patterns, printing response shape and `$metadata` snippets to discover API behavior.
