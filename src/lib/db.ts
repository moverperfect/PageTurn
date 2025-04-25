// Types for our book and reading session data
import { eq, and, sql } from 'drizzle-orm';
import { getDbClient } from './db-client';
import { books, readingSessions, type Book, type ReadingSession } from './schema';
import { v4 as uuidv4 } from 'uuid';

/**
 * Calculates reading progress statistics for a book based on its reading sessions.
 *
 * Returns an object containing the total pages read, percent complete, average minutes per page, pages per hour, and estimated hours left to finish the book.
 *
 * @param book - The book for which to calculate progress.
 * @param sessions - All reading sessions, including those for other books.
 * @returns An object with progress metrics: {@link pagesRead}, {@link percentComplete}, {@link minutesPerPage}, {@link pagesPerHour}, and {@link estimatedHoursLeft}.
 */
export function calculateProgress(book: Book, sessions: ReadingSession[]): {
  pagesRead: number;
  percentComplete: number;
  minutesPerPage: number;
  pagesPerHour: number;
  estimatedHoursLeft: number;
} {
  const bookSessions = sessions.filter(session => session.bookId === book.id);
  const sessionPagesRead = bookSessions.reduce((sum, session) => sum + session.pagesRead, 0);
  const totalPagesRead = sessionPagesRead + book.startingPage;
  const percentComplete = (totalPagesRead / book.pageCount) * 100;

  const totalDurationSeconds = bookSessions.reduce((sum, session) => sum + session.duration, 0);
  const totalDurationMinutes = totalDurationSeconds / 60;
  const minutesPerPage = sessionPagesRead === 0 ? 0 : totalDurationMinutes / sessionPagesRead;
  const pagesPerHour = totalDurationMinutes === 0 ? 0 : sessionPagesRead / (totalDurationMinutes / 60);

  const pagesLeft = book.pageCount - totalPagesRead;
  const estimatedHoursLeft = (pagesLeft * minutesPerPage) / 60;

  return {
    pagesRead: totalPagesRead,
    percentComplete,
    minutesPerPage,
    pagesPerHour,
    estimatedHoursLeft
  };
}

/**
 * Estimates the finish date for a book based on past reading sessions.
 *
 * Calculates the average interval between sessions and average pages read per session to project when the book will be completed. Returns null if there are no sessions for the book.
 *
 * @param book - The book for which to estimate the finish date.
 * @param sessions - All reading sessions, including those for other books.
 * @returns A Date representing the estimated finish date, or null if no sessions exist for the book.
 */
export function estimateFinishDate(book: Book, sessions: ReadingSession[]): Date | null {
  const bookSessions = sessions.filter(session => session.bookId === book.id);
  if (bookSessions.length === 0) return null;

  // Calculate average reading frequency (days between sessions)
  let totalDaysBetween = 0;
  const dates = bookSessions.map(s => new Date(s.date)).sort((a, b) => a.getTime() - b.getTime());

  for (let i = 1; i < dates.length; i++) {
    const daysDiff = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    totalDaysBetween += daysDiff;
  }

  const avgDaysBetweenSessions = dates.length > 1 ? totalDaysBetween / (dates.length - 1) : 7; // Default to 7 if only one session

  // Calculate average pages per session
  const avgPagesPerSession = bookSessions.reduce((sum, s) => sum + s.pagesRead, 0) / bookSessions.length;

  // Calculate remaining pages
  const pagesRead = bookSessions.reduce((sum, s) => sum + s.pagesRead, 0);
  const pagesLeft = book.pageCount - pagesRead;

  // Calculate estimated sessions left
  const sessionsLeft = Math.ceil(pagesLeft / avgPagesPerSession);

  // Calculate estimated days left
  const daysLeft = sessionsLeft * avgDaysBetweenSessions;

  // Calculate finish date
  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + daysLeft);

  return finishDate;
}

/**
 * Retrieves all books from the database.
 *
 * @returns A promise that resolves to an array of all books.
 */
export async function getAllBooks(env: Env): Promise<Book[]> {
  const db = getDbClient(env);
  return await db.select().from(books);
}

/**
 * Retrieves a book by its unique ID.
 *
 * @param id - The unique identifier of the book to retrieve.
 * @returns The book with the specified {@link id}, or undefined if not found.
 *
 * @throws {Error} If a database error occurs during retrieval.
 */
export async function getBookById(id: string, env: Env): Promise<Book | undefined> {
  try {
    const db = getDbClient(env);
    const results = await db.select().from(books).where(eq(books.id, id));
    return results[0];
  } catch (error) {
    console.error('Error getting book by ID:', error);
    throw new Error(`Failed to retrieve book: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Adds a new book to the database with a generated unique ID.
 *
 * @param bookData - The book details excluding the ID.
 * @returns The newly added book, including its generated ID.
 *
 * @throws {Error} If the book could not be added to the database.
 */
export async function addBook(bookData: Omit<Book, 'id'>, env: Env): Promise<Book> {
  const newBook = {
    ...bookData,
    id: uuidv4()
  };

  try {
    const db = getDbClient(env);
    await db.insert(books).values(newBook);
    return newBook;
  } catch (error) {
    console.error('Error adding book:', error);
    throw new Error(`Failed to add book: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Updates the specified fields of a book by its ID and returns the updated book.
 *
 * @param id - The unique identifier of the book to update.
 * @param updates - An object containing the fields to update.
 * @returns The updated book, or undefined if no book with the given ID exists.
 *
 * @throws {Error} If the update operation fails.
 */
export async function updateBook(id: string, updates: Partial<Omit<Book, 'id'>>, env: Env): Promise<Book | undefined> {
  try {
    const db = getDbClient(env);
    await db.update(books).set(updates).where(eq(books.id, id));

    // Get the updated book
    const results = await db.select().from(books).where(eq(books.id, id));
    return results[0];
  } catch (error) {
    console.error('Error updating book:', error);
    throw new Error(`Failed to update book: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Deletes a book by its ID.
 *
 * @param id - The unique identifier of the book to delete.
 * @returns True if the book was deleted; false if no matching book was found.
 *
 * @throws {Error} If a database error occurs during deletion.
 */
export async function deleteBook(id: string, env: Env): Promise<boolean> {
  try {
    const db = getDbClient(env);
    const result = await db.delete(books).where(eq(books.id, id));
    return 'changes' in result ? result.changes > 0 : false;
  } catch (error) {
    console.error('Error deleting book:', error);
    throw new Error(`Failed to delete book: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves all reading sessions from the database.
 *
 * @returns An array of all {@link ReadingSession} records.
 *
 * @throws {Error} If the database query fails.
 */
export async function getAllReadingSessions(env: Env): Promise<ReadingSession[]> {
  try {
    const db = getDbClient(env);
    return await db.select().from(readingSessions);
  } catch (error) {
    console.error('Error getting all reading sessions:', error);
    throw new Error(`Failed to get all reading sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves all reading sessions associated with a specific book.
 *
 * @param bookId - The ID of the book whose reading sessions are to be fetched.
 * @returns An array of {@link ReadingSession} objects for the specified book.
 *
 * @throws {Error} If the database query fails.
 */
export async function getReadingSessionsForBook(bookId: string, env: Env): Promise<ReadingSession[]> {
  try {
    const db = getDbClient(env);
    return await db.select().from(readingSessions).where(eq(readingSessions.bookId, bookId));
  } catch (error) {
    console.error('Error getting reading sessions for book:', error);
    throw new Error(`Failed to get reading sessions for book: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves a reading session by its unique ID.
 *
 * @param sessionId - The ID of the reading session to retrieve.
 * @returns The matching {@link ReadingSession} if found, or null if not found.
 *
 * @throws {Error} If a database error occurs during retrieval.
 */
export async function getReadingSessionById(
  sessionId: string,
  env: Env
): Promise<ReadingSession | null> {
  try {
    const db = getDbClient(env);
    const [session] = await db
      .select()
      .from(readingSessions)
      .where(eq(readingSessions.id, sessionId))
      .limit(1);
    return session ?? null;
  } catch (error) {
    console.error('Error getting reading session by ID:', error);
    throw new Error(`Failed to get reading session by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Adds a new reading session to the database and returns the created session.
 *
 * @returns The newly created {@link ReadingSession} object, including its generated ID.
 *
 * @throws {Error} If the reading session could not be added to the database.
 */
export async function addReadingSession(sessionData: Omit<ReadingSession, 'id'>, env: Env): Promise<ReadingSession> {
  const newSession = {
    ...sessionData,
    id: uuidv4()
  };

  try {
    const db = getDbClient(env);
    await db.insert(readingSessions).values(newSession);
    return newSession;
  } catch (error) {
    console.error('Error adding reading session:', error);
    throw new Error(`Failed to add reading session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Updates a reading session by its ID with the specified fields.
 *
 * @param id - The ID of the reading session to update.
 * @param updates - The fields to update in the reading session.
 * @returns The updated reading session, or undefined if not found.
 *
 * @throws {Error} If the update operation fails.
 */
export async function updateReadingSession(id: string, updates: Partial<Omit<ReadingSession, 'id'>>, env: Env): Promise<ReadingSession | undefined> {
  try {
    const db = getDbClient(env);
    await db.update(readingSessions).set(updates).where(eq(readingSessions.id, id));

    // Get the updated session
    const results = await db.select().from(readingSessions).where(eq(readingSessions.id, id));
    return results[0];
  } catch (error) {
    console.error('Error updating reading session:', error);
    throw new Error(`Failed to update reading session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Deletes a reading session by its ID.
 *
 * @param id - The unique identifier of the reading session to delete.
 * @returns True if the reading session was deleted; false if no matching session was found.
 *
 * @throws {Error} If a database error occurs during deletion.
 */
export async function deleteReadingSession(id: string, env: Env): Promise<boolean> {
  try {
    const db = getDbClient(env);
    const result = await db.delete(readingSessions).where(eq(readingSessions.id, id));
    return 'changes' in result ? result.changes > 0 : false;
  } catch (error) {
    console.error('Error deleting reading session:', error);
    throw new Error(`Failed to delete reading session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves all books that are currently being read, based on the finished flag and reading activity.
 *
 * A book is considered currently being read if:
 * 1. It is not marked as finished
 * 2. AND (it has at least one reading session OR its starting page is greater than 0)
 *
 * @returns A promise that resolves to an array of books that are in progress.
 *
 * @throws {Error} If the database query fails.
 */
export async function getCurrentlyReadingBooks(env: Env): Promise<Book[]> {
  try {
    const db = getDbClient(env);

    return await db
      .select()
      .from(books)
      .where(
        and(
          eq(books.finished, false),
          sql`(
            EXISTS (
              SELECT 1 
              FROM ${readingSessions}
              WHERE ${readingSessions.bookId} = ${books.id}
            )
            OR ${books.startingPage} > 0
          )`
        )
      );
  } catch (error) {
    console.error('Error getting currently reading books:', error);
    throw new Error(`Failed to get currently reading books: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves a book by matching its title and author, using case-insensitive comparison.
 *
 * @param title - The title of the book to search for.
 * @param author - The author of the book to search for.
 * @returns The matching {@link Book}, or undefined if no match is found.
 *
 * @throws {Error} If a database error occurs during the query.
 */
export async function getBookByTitleAndAuthor(title: string, author: string, env: Env): Promise<Book | undefined> {
  try {
    const db = getDbClient(env);
    const results = await db
      .select()
      .from(books)
      .where(
        and(
          sql`LOWER(${books.title}) = LOWER(${title})`,
          sql`LOWER(${books.author}) = LOWER(${author})`
        )
      );
    return results[0];
  } catch (error) {
    console.error('Error getting book by title and author:', error);
    throw new Error(`Failed to get book by title and author: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
