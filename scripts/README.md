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
