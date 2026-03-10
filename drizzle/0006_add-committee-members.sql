-- Add committee_members table for storing scraped member rosters
CREATE TABLE IF NOT EXISTS "committee_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "category_name" text NOT NULL,
  "name" text NOT NULL,
  "role" text,
  "source_url" text,
  "scraped_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committee_members_category_idx" ON "committee_members" USING btree ("category_name");
