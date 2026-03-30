import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log('Starting notifications v2 migration...');

  try {
    console.log('Adding agenda_posted_enabled to notification_preferences...');
    await sql`
      ALTER TABLE "notification_preferences"
      ADD COLUMN IF NOT EXISTS "agenda_posted_enabled" text DEFAULT 'true'
    `;

    console.log('Adding transcript_ready_enabled to notification_preferences...');
    await sql`
      ALTER TABLE "notification_preferences"
      ADD COLUMN IF NOT EXISTS "transcript_ready_enabled" text DEFAULT 'true'
    `;

    console.log('Creating event_document_snapshots table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "event_document_snapshots" (
        "id" serial PRIMARY KEY NOT NULL,
        "event_id" integer NOT NULL UNIQUE,
        "known_file_count" integer NOT NULL DEFAULT 0,
        "last_checked_at" timestamp DEFAULT now()
      )
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "event_doc_snapshots_event_idx"
      ON "event_document_snapshots" ("event_id")
    `;

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
