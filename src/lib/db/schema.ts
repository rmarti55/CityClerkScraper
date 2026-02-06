import { pgTable, serial, text, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';

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

// User accounts
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'), // null if OAuth
  provider: text('provider'), // 'email', 'google', etc.
  providerId: text('provider_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User favorites
export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userEventIdx: uniqueIndex('favorites_user_event_idx').on(table.userId, table.eventId),
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
  cachedAt: timestamp('cached_at').defaultNow(),
}, (table) => ({
  eventIdx: index('files_event_idx').on(table.eventId),
}));

// Type exports for use in application
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
