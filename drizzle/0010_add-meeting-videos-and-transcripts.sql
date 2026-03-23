CREATE TABLE IF NOT EXISTS "meeting_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"youtube_video_id" text,
	"youtube_title" text,
	"youtube_published_at" timestamp,
	"youtube_thumbnail_url" text,
	"duration" text,
	"source" text NOT NULL,
	"match_confidence" integer,
	"matched_at" timestamp DEFAULT now(),
	"external_media_url" text
);

CREATE INDEX IF NOT EXISTS "meeting_videos_event_idx" ON "meeting_videos" USING btree ("event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_videos_youtube_idx" ON "meeting_videos" USING btree ("youtube_video_id");

CREATE TABLE IF NOT EXISTS "meeting_transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"raw_transcript" text,
	"cleaned_transcript" text,
	"summary_json" text,
	"speakers_json" text,
	"topics_json" text,
	"model" text,
	"status" text NOT NULL DEFAULT 'pending',
	"error_message" text,
	"generated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meeting_transcripts_video_idx" ON "meeting_transcripts" USING btree ("video_id");
CREATE INDEX IF NOT EXISTS "meeting_transcripts_event_idx" ON "meeting_transcripts" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "meeting_transcripts_status_idx" ON "meeting_transcripts" USING btree ("status");
