import type { APIRoute } from 'astro';
import { addBook, addReadingSession, getBookByTitleAndAuthor } from '../../lib/db';
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
 * Parses CSV text into a two-dimensional array of strings.
 *
 * Handles quoted fields, embedded commas, escaped quotes, and normalizes line endings.
 *
 * @param text - The CSV-formatted string to parse.
 * @returns An array of rows, each row being an array of field values.
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

// Convert sheet data to Book objects
function convertToBooks(sheetData: any[]): Omit<Book, 'id'>[] {
  return sheetData.map(row => {
    // Handle required fields - using lowercase keys for case insensitivity
    if (!row.title || !row.author || !row.format || !row.pagecount) {
      throw new Error(`Missing required fields in row: ${JSON.stringify(row)}`);
    }

    // Create book object with defaults for optional fields
    const book: Omit<Book, 'id'> = {
      title: row.title,
      author: row.author,
      format: row.format,
      pageCount: parseInt(row.pagecount) || 0,
      isbn: row.isbn || '',
      authorSex: (row.authorsex as 'M' | 'F' | 'Other' | 'Unknown') || 'Unknown',
      recommended: row.recommended?.toLowerCase() === 'true' || false,
      genre: row.genre || '',
      publishedYear: parseInt(row.publishedyear) || 0,
      publisher: row.publisher || '',
      dateAcquired: row.dateacquired || new Date().toISOString(),
      dateRemoved: null,
      cost: parseFloat(row.cost) || 0
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
 * Parses a date string in various formats and returns an ISO 8601 string.
 *
 * Supports `dd/mm/yyyy` format by converting it to ISO format. Falls back to standard JavaScript date parsing for other formats. If parsing fails or the input is empty, returns the current date in ISO format.
 *
 * @param dateStr - The date string to parse.
 * @returns The parsed date as an ISO 8601 string.
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Try to detect if it's in dd/mm/yyyy format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    // If it looks like dd/mm/yyyy format
    if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2) {
      // Convert to yyyy-mm-dd for parsing
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];

      return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
    }
  }

  // Try standard JS date parsing
  try {
    return new Date(dateStr).toISOString();
  } catch (e) {
    console.error('Error parsing date:', dateStr);
    return new Date().toISOString();
  }
}

/**
 * Converts raw sheet data into an array of reading session objects, resolving book references asynchronously.
 *
 * Each row must include a date and either a title with author or a library book number. If a title and author are provided, the corresponding book is looked up in the database; otherwise, the library book number is used as the book ID. Parses and normalizes fields such as pages read, duration (in seconds), date, and finished status.
 *
 * @param sheetData - Array of objects representing rows from the sheet.
 * @param env - Environment context used for database lookups.
 * @returns A promise that resolves to an array of reading session objects without IDs.
 *
 * @throws {Error} If required fields are missing or if a referenced book cannot be found.
 */
async function convertToReadingSessions(sheetData: any[], env: Env): Promise<Omit<ReadingSession, 'id'>[]> {
  const sessionPromises = sheetData.map(async row => {
    // We need date and either (title + author) or (library book #)
    if (!row.date || ((!row.title || !row.author) && !row['library book #'])) {
      throw new Error(`Missing required fields in row: ${JSON.stringify(row)}`);
    }

    // Find the book by title and author
    let bookId: string;
    if (row.title && row.author) {
      const book = await getBookByTitleAndAuthor(row.title, row.author, env);
      if (!book) {
        throw new Error(`Book not found: ${row.title} by ${row.author}`);
      }
      bookId = book.id;
    } else {
      // Assuming library book # is the book ID
      bookId = row['library book #'];
    }

    // Parse pages read
    const pagesRead = parseInt(row['pages read'] || row.pagesread) || 0;

    // Parse duration - handle HH:MM:SS format - now returns seconds
    const duration = parseDuration(row.duration);

    // Parse date - handle dd/mm/yyyy format
    const date = parseDate(row.date);

    // Determine if book was finished
    const finished = row.finished?.toLowerCase() === 'true' || false;

    // Create reading session object
    const session: Omit<ReadingSession, 'id'> = {
      date,
      bookId,
      pagesRead,
      duration,
      finished
    };

    return session;
  });

  return Promise.all(sessionPromises);
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

      // Add books to the database
      // Create an array of promises for adding books
      const bookPromises = books.map(bookData => addBook(bookData, locals.runtime.env));

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
      const sessions = await convertToReadingSessions(sheetData, locals.runtime.env);

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

