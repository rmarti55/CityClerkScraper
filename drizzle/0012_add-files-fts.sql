-- Full-text search: tsvector column + GIN index on files
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(type, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "files_search_idx" ON "files" USING gin ("search_vector");
