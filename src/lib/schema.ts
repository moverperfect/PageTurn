import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  format: text('format').notNull(),
  pageCount: integer('page_count').notNull(),
  isbn: text('isbn').notNull(),
  authorSex: text('author_sex', { enum: ['M', 'F', 'Other', 'Unknown'] }).notNull(),
  recommended: integer('recommended', { mode: 'boolean' }).notNull(),
  genre: text('genre').notNull(),
  publishedYear: integer('published_year').notNull(),
  publisher: text('publisher').notNull(),
  dateAcquired: text('date_acquired').notNull(), // ISO date string format
  dateRemoved: text('date_removed'),             // ISO date string format, optional
  cost: real('cost').notNull(),
  startingPage: integer('starting_page').default(0).notNull(),
  finished: integer('finished', { mode: 'boolean' }).default(false).notNull(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const readingSessions = sqliteTable('reading_sessions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),                // ISO date string format
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  pagesRead: integer('pages_read').notNull(),
  duration: integer('duration').notNull(),     // in seconds
  finished: integer('finished', { mode: 'boolean' }).notNull(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const user = sqliteTable("user", {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const session = sqliteTable("session", {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable("account", {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable("verification", {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
});

// Types for our book and reading session data
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type ReadingSession = typeof readingSessions.$inferSelect;
export type NewReadingSession = typeof readingSessions.$inferInsert;

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
