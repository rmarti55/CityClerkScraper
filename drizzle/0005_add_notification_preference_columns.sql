-- Add confirmation and meeting reminder preference columns
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "confirmation_email_enabled" text DEFAULT 'true';
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "meeting_reminder_enabled" text DEFAULT 'true';
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "meeting_reminder_minutes_before" integer DEFAULT 60;
