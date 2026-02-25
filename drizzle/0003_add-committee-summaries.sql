-- Add committee_summaries table for caching LLM-generated summaries
CREATE TABLE IF NOT EXISTS "committee_summaries" (
  "id" serial PRIMARY KEY NOT NULL,
  "category_name" text NOT NULL UNIQUE,
  "summary" text NOT NULL,
  "generated_at" timestamp DEFAULT now(),
  "last_meeting_id" integer,
  "model" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "committee_summaries_category_idx" ON "committee_summaries" USING btree ("category_name");
