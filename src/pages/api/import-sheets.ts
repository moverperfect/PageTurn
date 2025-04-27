import type { APIRoute } from 'astro';
import { addBook, addReadingSession, getBookByTitleAndAuthor, updateBook, getBookById } from '../../lib/db';
import type { ReadingSession, Book } from '../../lib/schema';

interface ImportRequestBody {
  sheetId: string;
  sheetName?: string;
  type: 'books' | 'sessions';
}

// Function to fetch and parse data from a published Google Sheet
async function fetchSheetData(sheetId: string, sheetName: string = 'Sheet1'): Promise<any[]> {
  // Construct URL for published sheet in CSV format
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }

    const csvText = await response.text();

    // Parse CSV data
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      throw new Error('Sheet contains insufficient data');
    }

    // Extract headers and convert to objects
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        // Store all headers in lowercase to make them case insensitive
        obj[header.toLowerCase()] = row[index] || '';
      });
      return obj;
    });

    return data;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

/**
 * Parses CSV-formatted text into an array of rows, handling quoted fields, embedded commas, and escaped quotes.
 *
 * @param text - The CSV-formatted string to parse.
 * @returns An array of rows, where each row is an array of field values.
 */
function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  return lines.map(line => {
    // Handle quoted fields with commas
    const result: string[] = [];
    let inQuotes = false;
    let currentField = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' && line[i + 1] !== '"') {
        inQuotes = !inQuotes;
      } else if (char === '"' && line[i + 1] === '"') {
        currentField += '"';
        i++;
      } else if (char === ',' && !inQuotes) {
        result.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Add the last field
    result.push(currentField);

    // Clean up quotes and whitespace
    return result.map(field => field.trim().replace(/^"|"$/g, ''));
  }).filter(line => line.length > 0 && line[0] !== '');
}

/**
 * Converts parsed sheet data rows into book objects, omitting `id` and `userId`.
 *
 * Validates the presence of required fields (`title`, `author`, `format`, `pagecount`) and parses numeric fields with error handling. Optional fields are set to defaults if missing.
 *
 * @param sheetData - Array of row objects from the parsed sheet, with lowercase keys.
 * @returns An array of book objects ready for database insertion, excluding `id` and `userId`.
 *
 * @throws {Error} If a row is missing required fields or contains invalid numeric values.
 */
function convertToBooks(sheetData: any[]): Omit<Book, 'id' | 'userId'>[] {
  return sheetData.map(row => {
    // Handle required fields - using lowercase keys for case insensitivity
    if (!row.title || !row.author || !row.format || !row.pagecount) {
      throw new Error(`Missing required fields in row: ${JSON.stringify(row)}`);
    }

    // Create book object with defaults for optional fields
    const book: Omit<Book, 'id' | 'userId'> = {
      title: row.title,
      author: row.author,
      format: row.format,
      pageCount: (() => {
        const pc = Number.parseInt(row.pagecount);
        if (Number.isNaN(pc)) {
          throw new Error(`Invalid pageCount "${row.pagecount}"`);
        }
        return pc;
      })(),
      isbn: row.isbn || '',
      authorSex: (row.authorsex as 'M' | 'F' | 'Other' | 'Unknown') || 'Unknown',
      recommended: row.recommended?.toLowerCase() === 'true' || false,
      genre: row.genre || '',
      publishedYear: parseInt(row.publishedyear) || 0,
      publisher: row.publisher || '',
      dateAcquired: row.dateacquired || new Date().toISOString(),
      dateRemoved: null,
      cost: parseFloat(row.cost) || 0,
      startingPage: parseInt(row.startingpage) || 0,
      finished: row['finished?'] === 'Y' || false
    };

    return book;
  });
}

// Parse duration in HH:MM:SS format to seconds
function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;

  // Handle HH:MM:SS format
  if (durationStr.includes(':')) {
    const parts = durationStr.split(':').map(part => parseInt(part) || 0);
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1];
    }
  }

  // Fallback to assuming it's already in seconds
  return parseFloat(durationStr) || 0;
}

/**
 * Parses a date string in UK format (DD/MM/YYYY) and returns an ISO 8601 string.
 *
 * Treats dates with slashes as UK format DD/MM/YYYY by default.
 * For dates that don't contain slashes, falls back to standard JavaScript date parsing.
 * If parsing fails or the input is empty, returns the current date in ISO format.
 *
 * @param dateStr - The date string to parse.
 * @returns The parsed date as an ISO 8601 string.
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // For dates with slashes, assume UK format (DD/MM/YYYY)
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // Convert from DD/MM/YYYY to YYYY-MM-DD for parsing
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];

      return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
    }
  }

  // Try standard JS date parsing for other formats
  try {
    return new Date(dateStr).toISOString();
  } catch (e) {
    console.error('Error parsing date:', dateStr);
    return new Date().toISOString();
  }
}

// Function to update a book's startingPage value
async function updateBookCurrentPage(bookId: string, startingPage: number, env: Env): Promise<void> {
  try {
    await updateBook(bookId, { startingPage }, env);
  } catch (error) {
    console.error(`Error updating startingPage for book ${bookId}:`, error);
    throw error;
  }
}

/**
 * Converts sheet data rows into reading session objects, resolving book references and associating each session with a user.
 *
 * Each row must include a date and either a title with author or a library book number. Book references are resolved via database lookups. Fields such as pages read, cumulative pages, duration, date, and finished status are parsed and normalized. The function updates each book's starting page based on the earliest session and marks books as finished if indicated by the session data.
 *
 * @param sheetData - Array of objects representing rows from the sheet.
 * @param env - Environment context for database operations.
 * @param userId - The ID of the user to associate with each reading session.
 * @returns A promise resolving to an array of reading session objects without IDs.
 *
 * @throws {Error} If required fields are missing or if a referenced book cannot be found.
 */
async function convertToReadingSessions(sheetData: any[], env: Env, userId: string): Promise<Omit<ReadingSession, 'id'>[]> {
  // Group sessions by book to track which is first
  const sessionsByBook: Record<string, { session: Omit<ReadingSession, 'id'>, isFirst: boolean, startPage: number }[]> = {};
  // Track books that need to be marked as finished
  const booksToMarkFinished: Set<string> = new Set();

  // First pass - create all sessions and group by book
  const sessionPromises = sheetData.map(async row => {
    // We need date and either (title + author) or (library book #)
    if (!row.date || ((!row.title || !row.author) && !row['library book #'])) {
      throw new Error(`Missing required fields in row: ${JSON.stringify(row)}`);
    }

    // Find the book by title and author
    let bookId: string;
    let book: Book | undefined;

    if (row.title && row.author) {
      book = await getBookByTitleAndAuthor(row.title, row.author, env);
      if (!book) {
        throw new Error(`Book not found: ${row.title} by ${row.author}`);
      }
      bookId = book.id;
    } else {
      // Assuming library book # is the book ID
      bookId = row['library book #'];
      book = await getBookById(bookId, env);
      if (!book) {
        throw new Error(`Book not found with ID: ${bookId}`);
      }
    }

    // Parse pages read
    const pagesRead = parseInt(row['pages read'] || row.pagesread) || 0;

    // Parse cumulative pages if available
    const cumulativePages = parseInt(row['cum pages'] || row.cumulativepages) || 0;

    // Calculate starting page if cumulative pages is provided
    const rawStart = cumulativePages > 0 ? cumulativePages - pagesRead : 0;
    const startPage = Math.max(rawStart, 0);

    // Parse duration - handle HH:MM:SS format - now returns seconds
    const duration = parseDuration(row.duration);

    // Parse date - handle dd/mm/yyyy format
    const date = parseDate(row.date);

    // Determine if book was finished
    const finished = row['finished?'] === 'Y' || false;

    // Check if this session completes the book
    const reachesEnd = book.pageCount > 0 && cumulativePages >= book.pageCount;
    if (finished || reachesEnd) {
      booksToMarkFinished.add(bookId);
    }

    // Create reading session object
    const session: Omit<ReadingSession, 'id'> = {
      date,
      bookId,
      pagesRead,
      duration,
      finished,
      userId
    };

    // Group sessions by book
    if (!sessionsByBook[bookId]) {
      sessionsByBook[bookId] = [];
    }

    // Add to the book's sessions array
    sessionsByBook[bookId].push({
      session,
      isFirst: false, // Will set properly in second pass
      startPage
    });

    return { session, bookId, startPage };
  });

  const sessionData = await Promise.all(sessionPromises);

  // Second pass - identify first session for each book and update book's startingPage
  for (const bookId in sessionsByBook) {
    // Sort sessions by date
    sessionsByBook[bookId].sort((a, b) =>
      new Date(a.session.date).getTime() - new Date(b.session.date).getTime()
    );

    // Mark the earliest session as first
    if (sessionsByBook[bookId].length > 0) {
      sessionsByBook[bookId][0].isFirst = true;

      // Update book's startingPage with the starting page of first session
      const firstStartPage = sessionsByBook[bookId][0].startPage;
      if (firstStartPage > 0) {
        try {
          await updateBookCurrentPage(bookId, firstStartPage, env);
        } catch (error) {
          console.error(`Failed to update startingPage for book ${bookId}:`, error);
        }
      }
    }
  }

  // Update finished status for books
  for (const bookId of booksToMarkFinished) {
    try {
      await updateBook(bookId, { finished: true }, env);
      console.log(`Marked book ${bookId} as finished`);
    } catch (error) {
      console.error(`Failed to mark book ${bookId} as finished:`, error);
    }
  }

  // Return all sessions
  return sessionData.map(item => item.session);
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const requestData = await request.json() as ImportRequestBody;
    const { sheetId, sheetName = 'Sheet1', type = 'books' } = requestData;

    if (!sheetId) {
      return new Response(
        JSON.stringify({ error: 'Sheet ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch data from Google Sheets
    const sheetData = await fetchSheetData(sheetId, sheetName);

    if (type === 'books') {
      // Convert to Book objects
      const books = convertToBooks(sheetData);

      // Verify that user is authenticated
      if (!locals.session?.User?.id) {
        throw new Error('User must be authenticated to import books');
      }

      // Add books to the database
      // Create an array of promises for adding books
      const bookPromises = books.map(bookData => {
        // Ensure userId is included in the book data
        return addBook({ ...bookData, userId: locals.session.User.id }, locals.runtime.env);
      });

      // Wait for all books to be added
      const addedBooks = await Promise.all(bookPromises);

      return new Response(
        JSON.stringify({
          success: true,
          imported: addedBooks.length,
          books: addedBooks
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (type === 'sessions') {
      // Convert to ReadingSession objects
      if (!locals.session?.User?.id) {
        throw new Error('User must be authenticated to import reading sessions');
      }
      const sessions = await convertToReadingSessions(
        sheetData,
        locals.runtime.env,
        locals.session.User.id
      );

      // Add sessions to the database
      // Create an array of promises for adding sessions
      const sessionPromises = sessions.map(sessionData => addReadingSession(sessionData, locals.runtime.env));

      // Wait for all sessions to be added
      const addedSessions = await Promise.all(sessionPromises);

      return new Response(
        JSON.stringify({
          success: true,
          imported: addedSessions.length,
          sessions: addedSessions
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error(`Invalid import type: ${type}`);
    }
  } catch (error) {
    console.error('Import error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error during import'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

