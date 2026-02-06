CREATE TABLE "events" (
	"id" integer PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"event_description" text,
	"event_date" text NOT NULL,
	"start_date_time" timestamp NOT NULL,
	"agenda_id" integer,
	"agenda_name" text,
	"category_name" text,
	"is_published" text,
	"venue_name" text,
	"venue_address" text,
	"venue_city" text,
	"venue_state" text,
	"venue_zip" text,
	"file_count" integer DEFAULT 0,
	"file_names" text,
	"cached_at" timestamp DEFAULT now(),
	"search_vector" text
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" integer PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"publish_on" text,
	"file_type" integer,
	"cached_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text,
	"provider" text,
	"provider_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_start_date_idx" ON "events" USING btree ("start_date_time");--> statement-breakpoint
CREATE INDEX "events_category_idx" ON "events" USING btree ("category_name");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_event_idx" ON "favorites" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE INDEX "files_event_idx" ON "files" USING btree ("event_id");