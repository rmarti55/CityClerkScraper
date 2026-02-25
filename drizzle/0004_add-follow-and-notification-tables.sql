-- Category follows (e.g. Governing Body, Planning Commission)
CREATE TABLE IF NOT EXISTS "category_follows" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "category_name" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "category_follows" ADD CONSTRAINT "category_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "category_follows_user_category_idx" ON "category_follows" USING btree ("user_id","category_name");

-- Notification preferences (email digest)
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "email_digest_enabled" text DEFAULT 'true',
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_idx" ON "notification_preferences" USING btree ("user_id");

-- Sent notifications (avoid duplicate emails)
CREATE TABLE IF NOT EXISTS "sent_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "category_name" text,
  "sent_at" timestamp DEFAULT now(),
  "payload" text
);
--> statement-breakpoint
ALTER TABLE "sent_notifications" ADD CONSTRAINT "sent_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sent_notifications_user_type_category_idx" ON "sent_notifications" USING btree ("user_id","type","category_name");
