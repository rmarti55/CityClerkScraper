-- Cached agenda items from CivicClerk Meetings API (flattened item tree)
CREATE TABLE IF NOT EXISTS "agenda_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"agenda_id" integer NOT NULL,
	"outline_number" text NOT NULL,
	"item_name" text NOT NULL,
	"item_description" text,
	"cached_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agenda_items_event_idx" ON "agenda_items" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "agenda_items_agenda_idx" ON "agenda_items" USING btree ("agenda_id");

-- Full-text search: tsvector column + GIN index on agenda_items
ALTER TABLE "agenda_items" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(item_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(item_description, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "agenda_items_search_idx" ON "agenda_items" USING gin ("search_vector");

-- Full-text search: tsvector column + GIN index on events
-- Replace the old text search_vector column with a proper generated tsvector
ALTER TABLE "events" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "events" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(event_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(category_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(agenda_name, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(event_description, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(file_names, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS "events_search_idx" ON "events" USING gin ("search_vector");

-- Unique constraint: one set of agenda items per event (for upsert logic)
CREATE UNIQUE INDEX IF NOT EXISTS "agenda_items_event_outline_idx" ON "agenda_items" ("event_id", "outline_number");
