// Types for our book and reading session data
import { eq, and, sql, inArray, asc } from 'drizzle-orm';
import { getDbClient } from './db-client';
import {
  books,
  catalogProviderCache,
  contributions,
  contributors,
  editionContents,
  editionIdentifiers,
  editions,
  readingSessions,
  subjects,
  works,
  workSubjects,
  type Book,
  type Contribution,
  type Contributor,
  type Edition,
  type EditionContent,
  type EditionIdentifier,
  type ReadingSession,
  type Subject,
  type Work,
  type WorkSubject,
} from './schema';
import { v4 as uuidv4 } from 'uuid';

const WORK_SEARCH_LIMIT = 50;

export function foldSearchText(value: string): string {
  // toLowerCase() maps Greek final sigma (ΟΣ → ος) but not a lone Σ → σ,
  // and leaves ß distinct from ss. Fold those so caseless keys match.
  return value.normalize('NFC').toLowerCase().replaceAll('ß', 'ss').replaceAll('ς', 'σ');
}

/**
 * Inserts a Work and returns the persisted record with a generated ID.
 *
 * Persists `titleSearch` as the NFC-normalized, lowercased title (with final
 * sigma folded to σ) so catalog search can filter in D1 without loading the
 * full table.
 */
export async function insertWork(workData: Omit<Work, 'id' | 'titleSearch'>, env: Env): Promise<Work> {
  const newWork: Work = {
    ...workData,
    id: uuidv4(),
    titleSearch: foldSearchText(workData.title),
  };

  try {
    const db = getDbClient(env);
    await db.insert(works).values(newWork);
    return newWork;
  } catch (error) {
    console.error('Error adding work:', error);
    throw new Error(`Failed to add work: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves a Work by its unique ID.
 */
export async function getWorkById(id: string, env: Env): Promise<Work | undefined> {
  try {
    const db = getDbClient(env);
    const results = await db.select().from(works).where(eq(works.id, id)).limit(1);
    return results[0];
  } catch (error) {
    console.error('Error getting work by ID:', error);
    throw new Error(`Failed to retrieve work: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Searches locally stored Works by title substring.
 *
 * Matching uses the persisted NFC-lowercase `titleSearch` key (final sigma
 * folded to σ) so D1 can filter without SQLite `lower()` or loading the full
 * catalog into the Worker. D1 rejects LIKE patterns longer than 50 characters,
 * so substring matching uses `instr` instead of `LIKE`. A btree cannot serve
 * substring `instr`; FTS5 is follow-on. An empty query returns a title-ordered
 * page rather than every row. Results are always bounded with LIMIT 50.
 */
export async function searchWorks(query: string, env: Env): Promise<Work[]> {
  try {
    const db = getDbClient(env);
    const needle = foldSearchText(query.trim());
    if (!needle) {
      return await db
        .select()
        .from(works)
        .orderBy(asc(works.title))
        .limit(WORK_SEARCH_LIMIT);
    }

    return await db
      .select()
      .from(works)
      .where(sql`instr(${works.titleSearch}, ${needle}) > 0`)
      .orderBy(asc(works.title))
      .limit(WORK_SEARCH_LIMIT);
  } catch (error) {
    console.error('Error searching works:', error);
    throw new Error(`Failed to search works: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Inserts an Edition and its Edition Content for a Work in one D1 batch.
 */
export async function insertEditionWithContent(
  editionData: Omit<Edition, 'id'>,
  workId: string,
  env: Env
): Promise<{ edition: Edition; contents: EditionContent[] }> {
  const edition: Edition = {
    ...editionData,
    id: uuidv4(),
  };
  const content: EditionContent = {
    id: uuidv4(),
    editionId: edition.id,
    workId,
    sortOrder: 0,
  };

  try {
    const db = getDbClient(env);
    await db.batch([
      db.insert(editions).values(edition),
      db.insert(editionContents).values(content),
    ]);
    return { edition, contents: [content] };
  } catch (error) {
    console.error('Error adding edition:', error);
    throw new Error(`Failed to add edition: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves an Edition by its unique ID.
 */
export async function getEditionById(id: string, env: Env): Promise<Edition | undefined> {
  try {
    const db = getDbClient(env);
    const results = await db.select().from(editions).where(eq(editions.id, id)).limit(1);
    return results[0];
  } catch (error) {
    console.error('Error getting edition by ID:', error);
    throw new Error(`Failed to retrieve edition: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves Edition Contents for an Edition, ordered for display.
 */
export async function getEditionContents(
  editionId: string,
  env: Env
): Promise<EditionContent[]> {
  try {
    const db = getDbClient(env);
    return await db
      .select()
      .from(editionContents)
      .where(eq(editionContents.editionId, editionId))
      .orderBy(asc(editionContents.sortOrder));
  } catch (error) {
    console.error('Error getting edition contents:', error);
    throw new Error(`Failed to retrieve edition contents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves Editions that contain a Work, oldest-created first via content order.
 */
export async function getEditionsForWork(workId: string, env: Env): Promise<Edition[]> {
  try {
    const db = getDbClient(env);
    return await db
      .select({
        id: editions.id,
        displayedTitle: editions.displayedTitle,
        language: editions.language,
        publisher: editions.publisher,
        publicationDate: editions.publicationDate,
        format: editions.format,
        progressUnit: editions.progressUnit,
        coverUrl: editions.coverUrl,
        editionLength: editions.editionLength,
      })
      .from(editions)
      .innerJoin(editionContents, eq(editionContents.editionId, editions.id))
      .where(eq(editionContents.workId, workId))
      .orderBy(asc(editionContents.sortOrder), asc(editions.id));
  } catch (error) {
    console.error('Error getting editions for work:', error);
    throw new Error(`Failed to retrieve editions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export class IdentifierConflictError extends Error {
  constructor(
    message: string,
    readonly existingEditionId: string
  ) {
    super(message);
    this.name = 'IdentifierConflictError';
  }
}

/**
 * Retrieves typed identifiers for an Edition.
 */
export async function getIdentifiersForEdition(
  editionId: string,
  env: Env
): Promise<EditionIdentifier[]> {
  try {
    const db = getDbClient(env);
    return await db
      .select()
      .from(editionIdentifiers)
      .where(eq(editionIdentifiers.editionId, editionId))
      .orderBy(asc(editionIdentifiers.namespace), asc(editionIdentifiers.value));
  } catch (error) {
    console.error('Error getting edition identifiers:', error);
    throw new Error(`Failed to retrieve identifiers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Finds an identifier by namespace and normalized value.
 */
export async function findIdentifier(
  namespace: EditionIdentifier['namespace'],
  valueNormalized: string,
  env: Env
): Promise<EditionIdentifier | undefined> {
  try {
    const db = getDbClient(env);
    const results = await db
      .select()
      .from(editionIdentifiers)
      .where(
        and(
          eq(editionIdentifiers.namespace, namespace),
          eq(editionIdentifiers.valueNormalized, valueNormalized)
        )
      )
      .limit(1);
    return results[0];
  } catch (error) {
    console.error('Error finding identifier:', error);
    throw new Error(`Failed to find identifier: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Finds identifiers whose normalized value matches, any namespace.
 */
export async function findIdentifiersByNormalizedValue(
  valueNormalized: string,
  env: Env
): Promise<EditionIdentifier[]> {
  try {
    const db = getDbClient(env);
    return await db
      .select()
      .from(editionIdentifiers)
      .where(eq(editionIdentifiers.valueNormalized, valueNormalized))
      .orderBy(asc(editionIdentifiers.namespace));
  } catch (error) {
    console.error('Error finding identifiers by value:', error);
    throw new Error(`Failed to find identifier: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Assigns a typed identifier to an Edition. Conflicting values are rejected.
 */
export async function insertEditionIdentifier(
  identifier: Omit<EditionIdentifier, 'id'>,
  env: Env
): Promise<EditionIdentifier> {
  const existing = await findIdentifier(identifier.namespace, identifier.valueNormalized, env);
  if (existing) {
    if (existing.editionId === identifier.editionId) {
      return existing;
    }
    throw new IdentifierConflictError(
      'That identifier is already assigned to another Edition',
      existing.editionId
    );
  }

  const row: EditionIdentifier = {
    ...identifier,
    id: uuidv4(),
  };

  try {
    const db = getDbClient(env);
    await db.insert(editionIdentifiers).values(row);
    return row;
  } catch (error) {
    const raced = await findIdentifier(identifier.namespace, identifier.valueNormalized, env);
    if (raced) {
      if (raced.editionId === identifier.editionId) {
        return raced;
      }
      throw new IdentifierConflictError(
        'That identifier is already assigned to another Edition',
        raced.editionId
      );
    }
    console.error('Error adding identifier:', error);
    throw new Error(`Failed to add identifier: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface SubjectClassification {
  id: string;
  name: string;
  provenance: string | null;
}

/**
 * Finds a Subject by its normalized name, if one already exists.
 */
export async function findSubjectByNormalizedName(
  nameNormalized: string,
  env: Env
): Promise<Subject | undefined> {
  try {
    const db = getDbClient(env);
    const results = await db
      .select()
      .from(subjects)
      .where(eq(subjects.nameNormalized, nameNormalized))
      .limit(1);
    return results[0];
  } catch (error) {
    console.error('Error finding subject:', error);
    throw new Error(`Failed to find subject: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Inserts a Subject, or returns the existing one when the normalized name is taken.
 */
export async function insertSubject(
  name: string,
  nameNormalized: string,
  env: Env
): Promise<Subject> {
  const existing = await findSubjectByNormalizedName(nameNormalized, env);
  if (existing) {
    return existing;
  }

  const subject: Subject = {
    id: uuidv4(),
    name,
    nameNormalized,
  };

  try {
    const db = getDbClient(env);
    await db.insert(subjects).values(subject);
    return subject;
  } catch (error) {
    const raced = await findSubjectByNormalizedName(nameNormalized, env);
    if (raced) {
      return raced;
    }
    console.error('Error adding subject:', error);
    throw new Error(`Failed to add subject: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Attaches a Subject to a Work, keeping the first provenance if already classified.
 */
export async function classifyWorkWithSubject(
  workId: string,
  subjectId: string,
  provenance: string | null,
  env: Env
): Promise<WorkSubject> {
  try {
    const db = getDbClient(env);
    const existing = await db
      .select()
      .from(workSubjects)
      .where(and(eq(workSubjects.workId, workId), eq(workSubjects.subjectId, subjectId)))
      .limit(1);
    if (existing[0]) {
      return existing[0];
    }

    const classification: WorkSubject = {
      id: uuidv4(),
      workId,
      subjectId,
      provenance,
    };
    await db.insert(workSubjects).values(classification);
    return classification;
  } catch (error) {
    const db = getDbClient(env);
    const raced = await db
      .select()
      .from(workSubjects)
      .where(and(eq(workSubjects.workId, workId), eq(workSubjects.subjectId, subjectId)))
      .limit(1);
    if (raced[0]) {
      return raced[0];
    }
    console.error('Error classifying work:', error);
    throw new Error(`Failed to classify work: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves Subject classifications for one Work.
 */
export async function getSubjectClassificationsForWork(
  workId: string,
  env: Env
): Promise<SubjectClassification[]> {
  const byWork = await getSubjectClassificationsForWorks([workId], env);
  return byWork.get(workId) ?? [];
}

/**
 * Retrieves Subject classifications for many Works.
 */
export async function getSubjectClassificationsForWorks(
  workIds: string[],
  env: Env
): Promise<Map<string, SubjectClassification[]>> {
  const classified = new Map<string, SubjectClassification[]>();
  if (workIds.length === 0) {
    return classified;
  }

  try {
    const db = getDbClient(env);
    const rows = await db
      .select({
        workId: workSubjects.workId,
        id: subjects.id,
        name: subjects.name,
        provenance: workSubjects.provenance,
      })
      .from(workSubjects)
      .innerJoin(subjects, eq(subjects.id, workSubjects.subjectId))
      .where(inArray(workSubjects.workId, workIds))
      .orderBy(asc(subjects.name));

    for (const id of workIds) {
      classified.set(id, []);
    }
    for (const row of rows) {
      classified.get(row.workId)?.push({
        id: row.id,
        name: row.name,
        provenance: row.provenance ?? null,
      });
    }
    return classified;
  } catch (error) {
    console.error('Error getting subject classifications:', error);
    throw new Error(`Failed to retrieve subjects: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface ContributionCredit {
  id: string;
  role: Contribution['role'];
  contributor: { id: string; name: string };
}

export async function findContributorByNameSearch(
  nameSearch: string,
  env: Env
): Promise<Contributor | undefined> {
  try {
    const db = getDbClient(env);
    const results = await db
      .select()
      .from(contributors)
      .where(eq(contributors.nameSearch, nameSearch))
      .limit(1);
    return results[0];
  } catch (error) {
    console.error('Error finding contributor:', error);
    throw new Error(`Failed to find contributor: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function insertContributor(
  name: string,
  env: Env
): Promise<Contributor> {
  const nameSearch = foldSearchText(name);
  const existing = await findContributorByNameSearch(nameSearch, env);
  if (existing) {
    return existing;
  }

  const contributor: Contributor = {
    id: uuidv4(),
    name,
    nameSearch,
  };

  try {
    const db = getDbClient(env);
    await db.insert(contributors).values(contributor);
    return contributor;
  } catch (error) {
    const raced = await findContributorByNameSearch(nameSearch, env);
    if (raced) {
      return raced;
    }
    console.error('Error adding contributor:', error);
    throw new Error(`Failed to add contributor: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function insertContribution(
  contributionData: Omit<Contribution, 'id'>,
  env: Env
): Promise<Contribution> {
  try {
    const db = getDbClient(env);
    const existing = await db
      .select()
      .from(contributions)
      .where(
        and(
          eq(contributions.contributorId, contributionData.contributorId),
          eq(contributions.role, contributionData.role),
          contributionData.workId
            ? eq(contributions.workId, contributionData.workId)
            : eq(contributions.editionId, contributionData.editionId!)
        )
      )
      .limit(1);
    if (existing[0]) {
      return existing[0];
    }

    const contribution: Contribution = { ...contributionData, id: uuidv4() };
    await db.insert(contributions).values(contribution);
    return contribution;
  } catch (error) {
    console.error('Error adding contribution:', error);
    throw new Error(`Failed to add contribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteContribution(id: string, env: Env): Promise<boolean> {
  try {
    const db = getDbClient(env);
    const result = await db.delete(contributions).where(eq(contributions.id, id));
    if ('success' in result) {
      return result.success;
    }
    return false;
  } catch (error) {
    console.error('Error deleting contribution:', error);
    throw new Error(`Failed to delete contribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getContributionById(
  id: string,
  env: Env
): Promise<Contribution | undefined> {
  try {
    const db = getDbClient(env);
    const results = await db
      .select()
      .from(contributions)
      .where(eq(contributions.id, id))
      .limit(1);
    return results[0];
  } catch (error) {
    console.error('Error getting contribution:', error);
    throw new Error(`Failed to retrieve contribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

const PROVIDER_CACHE_TTL_SECONDS = 60 * 60;

export async function getProviderCache(
  cacheKey: string,
  env: Env
): Promise<string | null> {
  try {
    const db = getDbClient(env);
    const rows = await db
      .select()
      .from(catalogProviderCache)
      .where(eq(catalogProviderCache.cacheKey, cacheKey))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    if (Math.floor(Date.now() / 1000) - row.fetchedAt > PROVIDER_CACHE_TTL_SECONDS) {
      return null;
    }
    return row.payload;
  } catch (error) {
    console.error('Error reading provider cache:', error);
    return null;
  }
}

export async function setProviderCache(
  cacheKey: string,
  payload: string,
  env: Env
): Promise<void> {
  try {
    const db = getDbClient(env);
    const fetchedAt = Math.floor(Date.now() / 1000);
    await db
      .insert(catalogProviderCache)
      .values({ cacheKey, payload, fetchedAt })
      .onConflictDoUpdate({
        target: catalogProviderCache.cacheKey,
        set: { payload, fetchedAt },
      });
  } catch (error) {
    console.error('Error writing provider cache:', error);
  }
}

async function creditsWhere(
  column: typeof contributions.workId | typeof contributions.editionId,
  ids: string[],
  env: Env
): Promise<Map<string, ContributionCredit[]>> {
  const credits = new Map<string, ContributionCredit[]>();
  if (ids.length === 0) {
    return credits;
  }

  const db = getDbClient(env);
  const rows = await db
    .select({
      targetId: column,
      id: contributions.id,
      role: contributions.role,
      contributorId: contributors.id,
      contributorName: contributors.name,
    })
    .from(contributions)
    .innerJoin(contributors, eq(contributors.id, contributions.contributorId))
    .where(inArray(column, ids))
    .orderBy(asc(contributions.role), asc(contributors.name));

  for (const id of ids) {
    credits.set(id, []);
  }
  for (const row of rows) {
    if (!row.targetId) {
      continue;
    }
    credits.get(row.targetId)?.push({
      id: row.id,
      role: row.role,
      contributor: { id: row.contributorId, name: row.contributorName },
    });
  }
  return credits;
}

export async function getCreditsForWork(
  workId: string,
  env: Env
): Promise<ContributionCredit[]> {
  return (await creditsWhere(contributions.workId, [workId], env)).get(workId) ?? [];
}

export async function getCreditsForEdition(
  editionId: string,
  env: Env
): Promise<ContributionCredit[]> {
  return (await creditsWhere(contributions.editionId, [editionId], env)).get(editionId) ?? [];
}

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
 * Retrieves all books in the database.
 *
 * @returns A promise that resolves to an array of all {@link Book} objects.
 */
export async function getAllBooks(env: Env): Promise<Book[]> {
  const db = getDbClient(env);
  return await db.select().from(books);
}

/**
 * Retrieves all books belonging to a specific user.
 *
 * @param userId - The unique identifier of the user whose books are being retrieved.
 * @returns A promise that resolves to an array of books owned by the specified user.
 *
 * @throws {Error} If a database error occurs while retrieving the books.
 */
export async function getAllBooksForUser(userId: string, env: Env): Promise<Book[]> {
  try {
    const db = getDbClient(env);
    return await db.select().from(books).where(eq(books.userId, userId));
  } catch (error) {
    console.error('Error getting all books for user:', error);
    throw new Error(`Failed to get all books for user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
 * Removes a book from the database by its unique ID.
 *
 * @param id - The unique identifier of the book to delete.
 * @returns True if the book was successfully deleted; false if no matching book was found.
 *
 * @throws {Error} If a database error occurs during deletion.
 */
export async function deleteBook(id: string, env: Env): Promise<boolean> {
  try {
    const db = getDbClient(env);
    const result = await db.delete(books).where(eq(books.id, id));
    if ('success' in result) {
      return result.success;
    }
    return false;
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
 * Retrieves all reading sessions for a given user.
 *
 * @param userId - The unique identifier of the user whose reading sessions are to be retrieved.
 * @returns An array of reading sessions for the specified user.
 *
 * @throws {Error} If the database query fails.
 */
export async function getAllReadingSessionsForUser(userId: string, env: Env): Promise<ReadingSession[]> {
  try {
    const db = getDbClient(env);
    return await db.select().from(readingSessions).where(eq(readingSessions.userId, userId));
  } catch (error) {
    console.error('Error getting all reading sessions for user:', error);
    throw new Error(`Failed to get all reading sessions for user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves all reading sessions for a given book.
 *
 * @param bookId - The unique identifier of the book.
 * @returns An array of reading sessions linked to the specified book.
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
 * Retrieves all reading sessions for the specified book IDs.
 *
 * Returns an empty array if no book IDs are provided.
 *
 * @param bookIds - The IDs of the books to retrieve reading sessions for.
 * @returns An array of reading sessions associated with the given books.
 *
 * @throws {Error} If the database query fails.
 */
export async function getReadingSessionsForBooks(bookIds: string[], env: Env): Promise<ReadingSession[]> {
  if (bookIds.length === 0) {
    return [];
  }

  try {
    const db = getDbClient(env);
    return await db
      .select()
      .from(readingSessions)
      .where(inArray(readingSessions.bookId, bookIds));
  } catch (error) {
    console.error('Error getting reading sessions for books:', error);
    throw new Error(`Failed to get reading sessions for books: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
 * Creates a new reading session in the database and returns the resulting session object.
 *
 * If {@link sessionData.userId} is not provided, the {@link userId} argument is used for the session's user.
 *
 * @returns The created {@link ReadingSession} with its generated ID.
 *
 * @throws {Error} If the reading session cannot be added to the database.
 */
export async function addReadingSession(sessionData: Omit<ReadingSession, 'id'>, env: Env, userId: string): Promise<ReadingSession> {
  const newSession = {
    ...sessionData,
    id: uuidv4(),
    userId: sessionData.userId || userId
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
 * Deletes a reading session by its unique ID.
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
    if ('success' in result) {
      return result.success;
    }
    return false;
  } catch (error) {
    console.error('Error deleting reading session:', error);
    throw new Error(`Failed to delete reading session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves all books for a user that are currently being read.
 *
 * A book is considered currently being read if it is not finished and either has at least one reading session or its starting page is greater than zero.
 *
 * @param userId - The unique identifier of the user whose books are being queried.
 * @returns A promise that resolves to an array of books in progress for the specified user.
 *
 * @throws {Error} If the database query fails.
 */
export async function getCurrentlyReadingBooksForUser(userId: string, env: Env): Promise<Book[]> {
  try {
    const db = getDbClient(env);

    return await db
      .select()
      .from(books)
      .where(
        and(
          eq(books.finished, false),
          eq(books.userId, userId),
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

/**
 * Retrieves a user's book by matching title and author with case-insensitive comparison.
 */
export async function getBookByTitleAndAuthorForUser(title: string, author: string, userId: string, env: Env): Promise<Book | undefined> {
  try {
    const db = getDbClient(env);
    const results = await db
      .select()
      .from(books)
      .where(
        and(
          eq(books.userId, userId),
          sql`LOWER(${books.title}) = LOWER(${title})`,
          sql`LOWER(${books.author}) = LOWER(${author})`
        )
      );
    return results[0];
  } catch (error) {
    console.error('Error getting book by title and author for user:', error);
    throw new Error(`Failed to get book by title and author for user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
