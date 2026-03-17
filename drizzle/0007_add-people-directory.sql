CREATE TABLE IF NOT EXISTS "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"title" text,
	"department" text,
	"email" text,
	"phone" text,
	"photo_url" text,
	"source_type" text,
	"source_url" text,
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "people_slug_unique" UNIQUE("slug"),
	CONSTRAINT "people_email_unique" UNIQUE("email")
);

CREATE INDEX IF NOT EXISTS "people_department_idx" ON "people" USING btree ("department");
CREATE INDEX IF NOT EXISTS "people_name_idx" ON "people" USING btree ("name");
