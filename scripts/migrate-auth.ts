import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log('Starting auth tables migration...');

  try {
    // Step 1: Create sessions table
    console.log('Creating sessions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "session_token" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "expires" timestamp NOT NULL
      )
    `;

    // Step 2: Create verification_tokens table
    console.log('Creating verification_tokens table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "verification_tokens" (
        "identifier" text NOT NULL,
        "token" text NOT NULL,
        "expires" timestamp NOT NULL,
        CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier", "token")
      )
    `;

    // Step 3: Create accounts table
    console.log('Creating accounts table...');
    await sql`
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
      )
    `;

    // Step 4: Check if users table needs migration
    console.log('Checking users table structure...');
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
    
    const columnNames = columns.map((c) => (c as { column_name: string }).column_name);
    const hasOldSchema = columnNames.includes('password_hash') || !columnNames.includes('email_verified');
    
    if (hasOldSchema) {
      console.log('Migrating users table to Auth.js schema...');
      
      // Create new users table
      await sql`
        CREATE TABLE IF NOT EXISTS "users_new" (
          "id" text PRIMARY KEY NOT NULL,
          "email" text NOT NULL UNIQUE,
          "email_verified" timestamp,
          "name" text,
          "image" text,
          "created_at" timestamp DEFAULT now(),
          "updated_at" timestamp DEFAULT now()
        )
      `;

      // Migrate existing users
      await sql`
        INSERT INTO "users_new" ("id", "email", "name", "created_at", "updated_at")
        SELECT 
          gen_random_uuid()::text,
          "email",
          "name",
          "created_at",
          "updated_at"
        FROM "users"
        ON CONFLICT ("email") DO NOTHING
      `;

      // Check if favorites table exists and has data
      const favoritesCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'favorites'
        ) as exists
      `;

      if (favoritesCheck[0]?.exists) {
        // Drop old foreign key if exists
        await sql`
          ALTER TABLE "favorites" DROP CONSTRAINT IF EXISTS "favorites_user_id_users_id_fk"
        `;

        // First change favorites.user_id column type from integer to text
        await sql`
          ALTER TABLE "favorites" ALTER COLUMN "user_id" TYPE text USING "user_id"::text
        `;

        // Update favorites to use new user IDs (if any exist)
        await sql`
          UPDATE "favorites" f
          SET "user_id" = (
            SELECT un."id" 
            FROM "users_new" un 
            JOIN "users" u ON u."email" = un."email" 
            WHERE u."id"::text = f."user_id"
          )
          WHERE EXISTS (
            SELECT 1 
            FROM "users_new" un 
            JOIN "users" u ON u."email" = un."email" 
            WHERE u."id"::text = f."user_id"
          )
        `;
      }

      // Drop old users table and rename new one
      await sql`DROP TABLE IF EXISTS "users"`;
      await sql`ALTER TABLE "users_new" RENAME TO "users"`;

      console.log('Users table migrated successfully!');
    } else {
      console.log('Users table already has Auth.js schema, skipping migration.');
    }

    // Step 5: Add foreign key constraints (if not exist)
    console.log('Adding foreign key constraints...');
    
    // Sessions FK
    await sql`
      DO $$ BEGIN
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" 
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;

    // Accounts FK
    await sql`
      DO $$ BEGIN
        ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" 
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;

    // Favorites FK
    await sql`
      DO $$ BEGIN
        ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" 
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;

    console.log('✅ Auth tables migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
