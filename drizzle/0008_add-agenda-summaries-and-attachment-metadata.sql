-- Cached AI-generated agenda item summaries (per meeting)
CREATE TABLE IF NOT EXISTS agenda_summaries (
  event_id INTEGER PRIMARY KEY,
  agenda_id INTEGER NOT NULL,
  summary_json TEXT NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Cached attachment metadata (size + page count)
CREATE TABLE IF NOT EXISTS attachment_metadata (
  attachment_id INTEGER PRIMARY KEY,
  agenda_id INTEGER NOT NULL,
  file_size INTEGER,
  page_count INTEGER,
  cached_at TIMESTAMP DEFAULT NOW()
);
