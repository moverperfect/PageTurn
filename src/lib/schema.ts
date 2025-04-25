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
});

// Types for our book and reading session data
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type ReadingSession = typeof readingSessions.$inferSelect;
export type NewReadingSession = typeof readingSessions.$inferInsert; 
