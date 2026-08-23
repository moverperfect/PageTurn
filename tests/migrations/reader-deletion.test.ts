/**
 * Verifies the deletion semantics of the migrated schema itself (issue #291):
 * `books.user_id` and `reading_sessions.user_id` must cascade when a Reader's
 * `user` row is deleted, as `src/lib/schema.ts` declares.
 *
 * The suite applies the real migration files to a scratch database the way
 * D1 does: foreign keys always enforced, each migration file executed as a
 * single transaction.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.resolve(import.meta.dirname, '../../migrations');

function migrationTags(): string[] {
  const journal = JSON.parse(
    readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf8')
  ) as { entries: { tag: string }[] };
  return journal.entries.map((entry) => entry.tag);
}

function applyMigration(db: DatabaseSync, tag: string): void {
  const sql = readFileSync(path.join(migrationsDir, `${tag}.sql`), 'utf8');
  db.exec('BEGIN');
  try {
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) {
        db.exec(statement);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function openScratchDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function openMigratedDatabase(): DatabaseSync {
  const db = openScratchDatabase();
  for (const tag of migrationTags()) {
    applyMigration(db, tag);
  }
  return db;
}

function insertUser(db: DatabaseSync, id: string): void {
  db.prepare(
    `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, 1, 0, 0)`
  ).run(id, id, `${id}@migrations.invalid`);
}

function insertBook(db: DatabaseSync, id: string, userId: string | null): void {
  db.prepare(
    `INSERT INTO books (
       id, title, author, format, page_count, isbn, author_sex, recommended,
       genre, published_year, publisher, date_acquired, date_removed, cost,
       starting_page, finished, user_id
     ) VALUES (?, 'Title', 'Author', 'physical', 100, '0000000000', 'Unknown',
       0, 'Fiction', 2020, 'Publisher', '2026-01-01', NULL, 9.99, 0, 0, ?)`
  ).run(id, userId);
}

function insertReadingSession(
  db: DatabaseSync,
  id: string,
  bookId: string,
  userId: string | null
): void {
  db.prepare(
    `INSERT INTO reading_sessions (id, date, book_id, pages_read, duration, finished, user_id)
     VALUES (?, '2026-01-02', ?, 10, 600, 0, ?)`
  ).run(id, bookId, userId);
}

function count(db: DatabaseSync, table: string, id: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE id = ?`)
    .get(id) as { n: number };
  return Number(row.n);
}

describe('the user_id cascade rebuild (0006)', () => {
  const REBUILD_TAG = '0006_user_fk_cascade';

  it('preserves existing rows and indexes', () => {
    const db = openScratchDatabase();
    try {
      const tags = migrationTags();
      const rebuildIndex = tags.indexOf(REBUILD_TAG);
      expect(rebuildIndex).toBeGreaterThan(0);
      for (const tag of tags.slice(0, rebuildIndex)) {
        applyMigration(db, tag);
      }

      insertUser(db, 'reader');
      insertBook(db, 'book', 'reader');
      insertBook(db, 'legacy-book', null);
      insertReadingSession(db, 'session', 'book', 'reader');
      const before = {
        books: db.prepare('SELECT * FROM books ORDER BY id').all(),
        sessions: db.prepare('SELECT * FROM reading_sessions ORDER BY id').all(),
      };

      for (const tag of tags.slice(rebuildIndex)) {
        applyMigration(db, tag);
      }

      expect(db.prepare('SELECT * FROM books ORDER BY id').all()).toEqual(before.books);
      expect(db.prepare('SELECT * FROM reading_sessions ORDER BY id').all()).toEqual(
        before.sessions
      );
      const indexes = db
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'index' AND tbl_name IN ('books', 'reading_sessions')
           AND name NOT LIKE 'sqlite_%' ORDER BY name`
        )
        .all()
        .map((row) => (row as { name: string }).name);
      expect(indexes).toEqual([
        'books_finished_idx',
        'books_genre_idx',
        'books_title_author_idx',
        'books_user_date_acquired_id_idx',
        'books_user_id_idx',
        'books_user_title_id_idx',
        'reading_sessions_book_date_idx',
        'reading_sessions_book_id_idx',
        'reading_sessions_user_date_id_idx',
        'reading_sessions_user_id_idx',
      ]);
    } finally {
      db.close();
    }
  });
});

describe('Reader deletion', () => {
  it('cascades to the `books` and `reading_sessions` rows the Reader owns', () => {
    const db = openMigratedDatabase();
    try {
      insertUser(db, 'reader');
      insertBook(db, 'book', 'reader');
      insertReadingSession(db, 'session', 'book', 'reader');

      db.prepare('DELETE FROM user WHERE id = ?').run('reader');

      expect(count(db, 'books', 'book')).toBe(0);
      expect(count(db, 'reading_sessions', 'session')).toBe(0);
    } finally {
      db.close();
    }
  });

  it('leaves other Readers and legacy unowned rows intact', () => {
    const db = openMigratedDatabase();
    try {
      insertUser(db, 'departing');
      insertBook(db, 'departing-book', 'departing');
      insertUser(db, 'staying');
      insertBook(db, 'staying-book', 'staying');
      insertReadingSession(db, 'staying-session', 'staying-book', 'staying');
      insertBook(db, 'legacy-book', null);
      insertReadingSession(db, 'legacy-session', 'legacy-book', null);

      db.prepare('DELETE FROM user WHERE id = ?').run('departing');

      expect(count(db, 'books', 'staying-book')).toBe(1);
      expect(count(db, 'reading_sessions', 'staying-session')).toBe(1);
      expect(count(db, 'books', 'legacy-book')).toBe(1);
      expect(count(db, 'reading_sessions', 'legacy-session')).toBe(1);
    } finally {
      db.close();
    }
  });
});
