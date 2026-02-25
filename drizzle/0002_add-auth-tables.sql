-- Migration: Add Auth.js tables for magic link authentication
-- This migration modifies the users table and adds sessions, accounts, and verification_tokens tables

-- Step 1: Create new auth tables first (before modifying users)

-- Sessions table for database-stored sessions (7-day expiry)
CREATE TABLE IF NOT EXISTS "sessions" (
  "session_token" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "expires" timestamp NOT NULL
);

-- Verification tokens for magic links
CREATE TABLE IF NOT EXISTS "verification_tokens" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp NOT NULL,
  CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier", "token")
);

-- OAuth accounts table (for future Google OAuth, etc.)
CREATE TABLE IF NOT EXISTS "accounts" (
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider", "provider_account_id")
);

-- Step 2: Migrate users table
-- Auth.js requires text ID (UUID) instead of serial integer

-- Create new users table with Auth.js compatible schema
CREATE TABLE IF NOT EXISTS "users_new" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" timestamp,
  "name" text,
  "image" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Migrate existing users (if any) - convert integer ID to UUID
INSERT INTO "users_new" ("id", "email", "name", "created_at", "updated_at")
SELECT 
  gen_random_uuid()::text,
  "email",
  "name",
  "created_at",
  "updated_at"
FROM "users"
ON CONFLICT ("email") DO NOTHING;

-- Drop old favorites foreign key constraint
ALTER TABLE "favorites" DROP CONSTRAINT IF EXISTS "favorites_user_id_users_id_fk";

-- Update favorites to use new user IDs
UPDATE "favorites" f
SET "user_id" = (
  SELECT un."id" 
  FROM "users_new" un 
  JOIN "users" u ON u."email" = un."email" 
  WHERE u."id"::text = f."user_id"::text
)
WHERE EXISTS (
  SELECT 1 
  FROM "users_new" un 
  JOIN "users" u ON u."email" = un."email" 
  WHERE u."id"::text = f."user_id"::text
);

-- Change favorites.user_id column type from integer to text
ALTER TABLE "favorites" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

-- Drop old users table
DROP TABLE IF EXISTS "users";

-- Rename new users table
ALTER TABLE "users_new" RENAME TO "users";

-- Step 3: Add foreign key constraints
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
