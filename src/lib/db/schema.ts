import { pgTable, serial, text, timestamp, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

// Cached events from CivicClerk API
export const events = pgTable('events', {
  id: integer('id').primaryKey(), // CivicClerk event ID
  eventName: text('event_name').notNull(),
  eventDescription: text('event_description'),
  eventDate: text('event_date').notNull(),
  startDateTime: timestamp('start_date_time').notNull(),
  agendaId: integer('agenda_id'),
  agendaName: text('agenda_name'),
  categoryName: text('category_name'),
  isPublished: text('is_published'),
  venueName: text('venue_name'),
  venueAddress: text('venue_address'),
  venueCity: text('venue_city'),
  venueState: text('venue_state'),
  venueZip: text('venue_zip'),
  fileCount: integer('file_count').default(0),
  fileNames: text('file_names'), // Concatenated file names for search
  cachedAt: timestamp('cached_at').defaultNow(),
  // Full-text search vector (auto-generated)
  searchVector: text('search_vector'),
}, (table) => ({
  startDateIdx: index('events_start_date_idx').on(table.startDateTime),
  categoryIdx: index('events_category_idx').on(table.categoryName),
}));

// ============================================
// Auth.js (NextAuth v5) Tables
// ============================================

// User accounts - Auth.js compatible
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// OAuth accounts (for future Google OAuth, etc.)
export const accounts = pgTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => ({
  pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
}));

// Database sessions (7-day expiry)
export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

// Magic link verification tokens
export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.identifier, table.token] }),
}));

// ============================================
// Application Tables
// ============================================

// User favorites (individual meeting follows)
export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userEventIdx: uniqueIndex('favorites_user_event_idx').on(table.userId, table.eventId),
}));

// User category follows (e.g. Governing Body, Planning Commission)
export const categoryFollows = pgTable('category_follows', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryName: text('category_name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userCategoryIdx: uniqueIndex('category_follows_user_category_idx').on(table.userId, table.categoryName),
}));

// User notification preferences (email digest, confirmation, meeting reminders)
export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  emailDigestEnabled: text('email_digest_enabled').default('true'), // 'true' | 'false'
  confirmationEmailEnabled: text('confirmation_email_enabled').default('true'), // 'true' | 'false'
  meetingReminderEnabled: text('meeting_reminder_enabled').default('true'), // 'true' | 'false'
  meetingReminderMinutesBefore: integer('meeting_reminder_minutes_before').default(60), // 0 = day-of (future)
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdx: uniqueIndex('notification_preferences_user_idx').on(table.userId),
}));

// Track sent notifications to avoid duplicate emails
export const sentNotifications = pgTable('sent_notifications', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'category_digest'
  categoryName: text('category_name'), // for category_digest
  sentAt: timestamp('sent_at').defaultNow(),
  payload: text('payload'), // JSON summary of what was sent
}, (table) => ({
  userTypeCategoryIdx: index('sent_notifications_user_type_category_idx').on(table.userId, table.type, table.categoryName),
}));

// Cached files metadata
export const files = pgTable('files', {
  id: integer('id').primaryKey(), // CivicClerk file ID
  eventId: integer('event_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  url: text('url').notNull(),
  publishOn: text('publish_on'),
  fileType: integer('file_type'),
  fileSize: integer('file_size'), // File size in bytes (lazy-loaded)
  pageCount: integer('page_count'), // PDF page count (lazy-loaded, null for non-PDFs)
  cachedAt: timestamp('cached_at').defaultNow(),
}, (table) => ({
  eventIdx: index('files_event_idx').on(table.eventId),
}));

// LLM-generated committee summaries (cached)
export const committeeSummaries = pgTable('committee_summaries', {
  id: serial('id').primaryKey(),
  categoryName: text('category_name').notNull().unique(),
  summary: text('summary').notNull(),
  generatedAt: timestamp('generated_at').defaultNow(),
  lastMeetingId: integer('last_meeting_id'), // Track which meeting triggered regeneration
  model: text('model'), // Which LLM model was used
}, (table) => ({
  categoryIdx: uniqueIndex('committee_summaries_category_idx').on(table.categoryName),
}));

// Type exports for use in application
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
export type CategoryFollow = typeof categoryFollows.$inferSelect;
export type NewCategoryFollow = typeof categoryFollows.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type SentNotification = typeof sentNotifications.$inferSelect;
export type NewSentNotification = typeof sentNotifications.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type CommitteeSummary = typeof committeeSummaries.$inferSelect;
export type NewCommitteeSummary = typeof committeeSummaries.$inferInsert;
