# Database Schema

PostgreSQL database managed via [Drizzle ORM](https://orm.drizzle.team/). Schema defined in `src/lib/db/schema.ts`, migrations in `drizzle/`.

## Table Overview

| Table | Purpose | PK |
|-------|---------|-----|
| `events` | Cached meeting/event data from CivicClerk API | `id` (CivicClerk event ID) |
| `files` | Cached file metadata per event | `id` (CivicClerk file ID) |
| `agenda_items` | Cached agenda items from CivicClerk (flattened tree) | `id` (serial) |
| `agenda_summaries` | AI-generated agenda item summaries per meeting | `event_id` |
| `attachment_metadata` | Cached attachment size and page count | `attachment_id` |
| `meeting_videos` | YouTube/CivicClerk video links to events | `id` (serial) |
| `meeting_transcripts` | AI-processed meeting transcripts | `id` (serial) |
| `committee_members` | Scraped committee member rosters | `id` (serial) |
| `committee_summaries` | LLM-generated committee summaries (cached) | `id` (serial) |
| `people` | Deduplicated directory of city officials and staff | `id` (serial) |
| `users` | Auth.js user accounts | `id` (UUID text) |
| `accounts` | OAuth provider accounts (Auth.js) | `(provider, provider_account_id)` |
| `sessions` | Database-backed sessions (Auth.js) | `session_token` |
| `verification_tokens` | Magic link tokens (Auth.js) | `(identifier, token)` |
| `favorites` | User-favorited meetings | `id` (serial) |
| `category_follows` | User-followed meeting categories | `id` (serial) |
| `notification_preferences` | Per-user notification settings | `id` (serial) |
| `sent_notifications` | Dedup log to prevent duplicate emails | `id` (serial) |
| `event_document_snapshots` | File count snapshots for detecting new uploads | `id` (serial) |
| `saved_documents` | User-bookmarked files and attachments | `id` (serial) |

## Relationships

```
users
 ├── accounts            (user_id → users.id, CASCADE)
 ├── sessions            (user_id → users.id, CASCADE)
 ├── favorites           (user_id → users.id, CASCADE)
 ├── category_follows    (user_id → users.id, CASCADE)
 ├── notification_preferences  (user_id → users.id, CASCADE, one-per-user)
 ├── sent_notifications  (user_id → users.id, CASCADE)
 └── saved_documents     (user_id → users.id, CASCADE)

events
 ├── files               (event_id → events.id, logical)
 ├── agenda_items        (event_id → events.id, logical)
 ├── agenda_summaries    (event_id → events.id, logical)
 ├── meeting_videos      (event_id → events.id, logical)
 ├── meeting_transcripts (event_id → events.id, logical)
 ├── favorites           (event_id → events.id, logical)
 └── event_document_snapshots (event_id → events.id, logical)

meeting_videos
 └── meeting_transcripts (video_id → meeting_videos.id, logical)
```

Note: relationships from `events` outward are logical (not enforced as foreign keys in the schema) because event IDs come from the external CivicClerk API. All `users`-related foreign keys are enforced with `ON DELETE CASCADE`.

---

## Table Details

### events

Cached meeting/event records from the CivicClerk API. Primary data table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer PK | CivicClerk event ID (not auto-generated) |
| `event_name` | text, NOT NULL | Meeting title |
| `event_description` | text | Optional description |
| `event_date` | text, NOT NULL | Display date string |
| `start_date_time` | timestamp, NOT NULL | Parsed to America/Denver timezone |
| `agenda_id` | integer | CivicClerk agenda ID (nullable for events without agendas) |
| `agenda_name` | text | Agenda title |
| `category_name` | text | e.g. "Governing Body", "Planning Commission" |
| `is_published` | text | Publication status |
| `venue_name` | text | Meeting venue name |
| `venue_address` | text | Street address |
| `venue_city` | text | City |
| `venue_state` | text | State |
| `venue_zip` | text | ZIP code |
| `file_count` | integer, default 0 | Number of attached files |
| `file_names` | text | Concatenated file names (for search) |
| `zoom_link` | text | Auto-extracted virtual meeting URL |
| `cached_at` | timestamp, default now | Last synced from CivicClerk |
| `search_vector` | text | PostgreSQL tsvector for full-text search |

Indexes: `start_date_time`, `category_name`.

### files

Cached file metadata. One row per file attached to an event.

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer PK | CivicClerk file ID |
| `event_id` | integer, NOT NULL | Parent event |
| `name` | text, NOT NULL | File name |
| `type` | text, NOT NULL | "Agenda", "Agenda Packet", "Minutes", etc. |
| `url` | text, NOT NULL | CivicClerk download URL |
| `publish_on` | text | Publication date |
| `file_type` | integer | CivicClerk file type code |
| `file_size` | integer | Bytes (lazy-loaded) |
| `page_count` | integer | PDF page count (null for non-PDFs, lazy-loaded) |
| `cached_at` | timestamp, default now | |
| `search_vector` | text | tsvector for full-text search |

Indexes: `event_id`.

### agenda_items

Flattened agenda item tree cached from CivicClerk `Meetings(agendaId)`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `event_id` | integer, NOT NULL | Parent event |
| `agenda_id` | integer, NOT NULL | CivicClerk agenda ID |
| `outline_number` | text, NOT NULL | e.g. "1.", "1.A.", "1.A.1." |
| `item_name` | text, NOT NULL | Agenda item title |
| `item_description` | text | HTML description (stripped on cache) |
| `cached_at` | timestamp, default now | |

Indexes: `event_id`, `agenda_id`.

### agenda_summaries

AI-generated summaries for all agenda items in a meeting. One row per meeting.

| Column | Type | Notes |
|--------|------|-------|
| `event_id` | integer PK | One summary set per event |
| `agenda_id` | integer, NOT NULL | |
| `summary_json` | text, NOT NULL | JSON array of item summaries |
| `generated_at` | timestamp, default now | |

### attachment_metadata

Lazy-loaded size and page count for agenda item attachments.

| Column | Type | Notes |
|--------|------|-------|
| `attachment_id` | integer PK | CivicClerk attachment ID |
| `agenda_id` | integer, NOT NULL | Parent agenda |
| `file_size` | integer | Bytes |
| `page_count` | integer | PDF pages |
| `cached_at` | timestamp, default now | |

### meeting_videos

Links YouTube videos (or CivicClerk media) to events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `event_id` | integer, NOT NULL | |
| `youtube_video_id` | text, UNIQUE | YouTube video ID |
| `youtube_title` | text | Video title |
| `youtube_published_at` | timestamp | Upload date |
| `youtube_thumbnail_url` | text | Thumbnail URL |
| `duration` | text | ISO 8601 duration |
| `source` | text, NOT NULL | `'youtube'` or `'civicclerk'` |
| `match_confidence` | integer | 0-100 score from fuzzy matcher |
| `matched_at` | timestamp, default now | |
| `external_media_url` | text | CivicClerk media URL (if source is civicclerk) |

Indexes: `event_id`, `youtube_video_id` (unique).

### meeting_transcripts

AI-processed transcripts linked to videos.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `video_id` | integer, NOT NULL, UNIQUE | References `meeting_videos.id` |
| `event_id` | integer, NOT NULL | |
| `raw_transcript` | text | Raw YouTube auto-captions |
| `cleaned_transcript` | text | AI-cleaned transcript |
| `summary_json` | text | JSON: executive summary, key decisions, action items, motions & votes |
| `speakers_json` | text | JSON: speaker-attributed segments |
| `topics_json` | text | JSON: extracted topic tags |
| `model` | text | LLM model used for processing |
| `status` | text, NOT NULL, default `'pending'` | `pending` / `extracting` / `processing` / `completed` / `failed` |
| `error_message` | text | Error details if status is `failed` |
| `generated_at` | timestamp, default now | |

Indexes: `video_id` (unique), `event_id`, `status`.

### committee_members

Committee member rosters scraped from city websites.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `category_name` | text, NOT NULL | Committee name |
| `name` | text, NOT NULL | Member name |
| `role` | text | "Chair", "Member", "Alternate", "Mayor", etc. |
| `source_url` | text | URL scraped from |
| `scraped_at` | timestamp, default now | |

Indexes: `category_name`.

### committee_summaries

LLM-generated committee summaries cached with 24h TTL.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `category_name` | text, NOT NULL, UNIQUE | One summary per committee |
| `summary` | text, NOT NULL | Generated summary text |
| `generated_at` | timestamp, default now | |
| `last_meeting_id` | integer | Event that triggered regeneration |
| `model` | text | LLM model used |

### people

Deduplicated directory of city officials and staff, merged from agenda sponsors, web scraping, and manual seed data.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `name` | text, NOT NULL | Full name |
| `slug` | text, NOT NULL, UNIQUE | URL-safe slug |
| `title` | text | Job title |
| `department` | text | Department or committee |
| `email` | text, UNIQUE | |
| `phone` | text | |
| `photo_url` | text | |
| `source_type` | text | `'scraped'`, `'agenda'`, or `'manual'` |
| `source_url` | text | |
| `is_active` | text, default `'true'` | |
| `created_at` | timestamp, default now | |
| `updated_at` | timestamp, default now | |

Indexes: `department`, `name`.

### users

Auth.js (NextAuth v5) user accounts. ID is a UUID string.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID via `crypto.randomUUID()` |
| `email` | text, NOT NULL, UNIQUE | |
| `email_verified` | timestamp | Set after magic link verification |
| `name` | text | |
| `image` | text | Profile image URL |
| `created_at` | timestamp, default now | |
| `updated_at` | timestamp, default now | |

### accounts

OAuth provider accounts (Auth.js standard). Currently unused (magic link only), reserved for future Google OAuth etc.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | text, NOT NULL | FK → `users.id` CASCADE |
| `type` | text, NOT NULL | |
| `provider` | text, NOT NULL | Part of composite PK |
| `provider_account_id` | text, NOT NULL | Part of composite PK |
| `refresh_token` | text | |
| `access_token` | text | |
| `expires_at` | integer | |
| `token_type` | text | |
| `scope` | text | |
| `id_token` | text | |
| `session_state` | text | |

PK: `(provider, provider_account_id)`.

### sessions

Database-backed sessions (7-day expiry).

| Column | Type | Notes |
|--------|------|-------|
| `session_token` | text PK | |
| `user_id` | text, NOT NULL | FK → `users.id` CASCADE |
| `expires` | timestamp, NOT NULL | |

### verification_tokens

Short-lived tokens for magic link email login.

| Column | Type | Notes |
|--------|------|-------|
| `identifier` | text, NOT NULL | Email address |
| `token` | text, NOT NULL | Unique token |
| `expires` | timestamp, NOT NULL | |

PK: `(identifier, token)`.

### favorites

Per-user meeting favorites. One row per user-event pair.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | text, NOT NULL | FK → `users.id` CASCADE |
| `event_id` | integer, NOT NULL | |
| `created_at` | timestamp, default now | |

Unique index: `(user_id, event_id)`.

### category_follows

Per-user category follows (e.g. "Governing Body").

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | text, NOT NULL | FK → `users.id` CASCADE |
| `category_name` | text, NOT NULL | |
| `created_at` | timestamp, default now | |

Unique index: `(user_id, category_name)`.

### notification_preferences

Per-user notification settings. One row per user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | text, NOT NULL, UNIQUE | FK → `users.id` CASCADE |
| `email_digest_enabled` | text, default `'true'` | `'true'` or `'false'` |
| `confirmation_email_enabled` | text, default `'true'` | |
| `meeting_reminder_enabled` | text, default `'true'` | |
| `meeting_reminder_minutes_before` | integer, default 60 | |
| `agenda_posted_enabled` | text, default `'true'` | |
| `transcript_ready_enabled` | text, default `'true'` | |
| `updated_at` | timestamp, default now | |

### sent_notifications

Deduplication log to prevent sending the same notification twice.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | text, NOT NULL | FK → `users.id` CASCADE |
| `type` | text, NOT NULL | e.g. `'category_digest'` |
| `category_name` | text | For digest-type notifications |
| `sent_at` | timestamp, default now | |
| `payload` | text | JSON summary of what was sent |

Index: `(user_id, type, category_name)`.

### event_document_snapshots

Tracks known file counts per event to detect when new agendas or documents are uploaded.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `event_id` | integer, NOT NULL, UNIQUE | |
| `known_file_count` | integer, NOT NULL, default 0 | Last-known count |
| `last_checked_at` | timestamp, default now | |

### saved_documents

User-bookmarked files and attachments.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | text, NOT NULL | FK → `users.id` CASCADE |
| `document_type` | text, NOT NULL | `'file'` or `'attachment'` |
| `document_id` | integer, NOT NULL | File or attachment ID |
| `event_id` | integer, NOT NULL | Parent event |
| `agenda_id` | integer | |
| `document_name` | text, NOT NULL | Original file name |
| `display_name` | text | User-facing display name |
| `document_category` | text | File type category |
| `created_at` | timestamp, default now | |

Unique index: `(user_id, document_type, document_id)`.

---

## Migrations

Migrations are in `drizzle/` and managed by Drizzle Kit. Run `npx drizzle-kit push` for new installs.

| Migration | Description |
|-----------|-------------|
| 0000 | Add `file_names` column to events |
| 0001 | Add file metadata table (`files`) |
| 0002 | Add Auth.js tables (`users`, `accounts`, `sessions`, `verification_tokens`) |
| 0003 | Add `committee_summaries` table |
| 0004 | Add follow and notification tables (`favorites`, `category_follows`, `notification_preferences`, `sent_notifications`) |
| 0005 | Add notification preference columns (`meeting_reminder_enabled`, `meeting_reminder_minutes_before`) |
| 0006 | Add `committee_members` table |
| 0007 | Add `people` directory table |
| 0008 | Add `agenda_summaries` and `attachment_metadata` tables |
| 0009 | Add `saved_documents` table |
| 0010 | Add `meeting_videos` and `meeting_transcripts` tables |
| 0011 | Add `agenda_items` table and full-text search indexes |
| 0012 | Add full-text search on `files` table |
| 0013 | Add `display_name` column to `saved_documents` |
