CREATE TABLE IF NOT EXISTS "saved_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_type" text NOT NULL,
	"document_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"agenda_id" integer,
	"document_name" text NOT NULL,
	"document_category" text,
	"created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "saved_docs_user_doc_idx" ON "saved_documents" USING btree ("user_id","document_type","document_id");

DO $$ BEGIN
 ALTER TABLE "saved_documents" ADD CONSTRAINT "saved_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
