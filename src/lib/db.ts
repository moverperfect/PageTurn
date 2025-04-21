// Types for our book and reading session data
import * as store from './store';

export interface Book {
  id: string;
  title: string;
  author: string;
  format: string;
  pageCount: number;
  isbn: string;
  authorSex: 'M' | 'F' | 'Other' | 'Unknown';
  recommended: boolean;
  genre: string;
  publishedYear: number;
  publisher: string;
  dateAcquired: string;
  dateRemoved: string | null;
  cost: number;
}

export interface ReadingSession {
  id: string;
  date: string;
  bookId: string;
  pagesRead: number;
  duration: number; // in seconds
  finished: boolean;
}

// Helper functions to calculate statistics
export function calculateProgress(book: Book, sessions: ReadingSession[]): {
  pagesRead: number;
  percentComplete: number;
  minutesPerPage: number;
  pagesPerHour: number;
  estimatedHoursLeft: number;
} {
  const bookSessions = sessions.filter(session => session.bookId === book.id);
  const pagesRead = bookSessions.reduce((sum, session) => sum + session.pagesRead, 0);
  const percentComplete = (pagesRead / book.pageCount) * 100;

  const totalDurationSeconds = bookSessions.reduce((sum, session) => sum + session.duration, 0);
  const totalDurationMinutes = totalDurationSeconds / 60;
  const minutesPerPage = totalDurationMinutes / pagesRead || 0;
  const pagesPerHour = pagesRead / (totalDurationMinutes / 60) || 0;

  const pagesLeft = book.pageCount - pagesRead;
  const estimatedHoursLeft = (pagesLeft * minutesPerPage) / 60;

  return {
    pagesRead,
    percentComplete,
    minutesPerPage,
    pagesPerHour,
    estimatedHoursLeft
  };
}

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

// Determine if we're in a browser or server context
const isBrowser = typeof window !== 'undefined';

// Helper function to make API requests (only used in browser context)
async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`/api/${endpoint}`, options);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return await response.json() as T;
}

// CRUD operations for books - smart routing between server and client contexts
export async function getAllBooks(): Promise<Book[]> {
  if (isBrowser) {
    return await apiRequest<Book[]>('books');
  } else {
    return store.getAllBooks();
  }
}

export async function getBookById(id: string): Promise<Book | undefined> {
  if (isBrowser) {
    return await apiRequest<Book | undefined>(`books/${id}`);
  } else {
    return store.getBookById(id);
  }
}

export async function addBook(book: Omit<Book, 'id'>): Promise<Book> {
  if (isBrowser) {
    return await apiRequest<Book>('books', 'POST', book);
  } else {
    return store.addBook(book);
  }
}

export async function updateBook(id: string, updates: Partial<Omit<Book, 'id'>>): Promise<Book | undefined> {
  if (isBrowser) {
    return await apiRequest<Book | undefined>(`books/${id}`, 'PUT', updates);
  } else {
    return store.updateBook(id, updates);
  }
}

export async function deleteBook(id: string): Promise<boolean> {
  if (isBrowser) {
    return await apiRequest<boolean>(`books/${id}`, 'DELETE');
  } else {
    return store.deleteBook(id);
  }
}

// CRUD operations for reading sessions
export async function getAllReadingSessions(): Promise<ReadingSession[]> {
  if (isBrowser) {
    return await apiRequest<ReadingSession[]>('reading-sessions');
  } else {
    return store.getAllReadingSessions();
  }
}

export async function getReadingSessionsForBook(bookId: string): Promise<ReadingSession[]> {
  if (isBrowser) {
    return await apiRequest<ReadingSession[]>(`reading-sessions/book/${bookId}`);
  } else {
    return store.getReadingSessionsForBook(bookId);
  }
}

export async function addReadingSession(session: Omit<ReadingSession, 'id'>): Promise<ReadingSession> {
  if (isBrowser) {
    return await apiRequest<ReadingSession>('reading-sessions', 'POST', session);
  } else {
    return store.addReadingSession(session);
  }
}

export async function updateReadingSession(id: string, updates: Partial<Omit<ReadingSession, 'id'>>): Promise<ReadingSession | undefined> {
  if (isBrowser) {
    return await apiRequest<ReadingSession | undefined>(`reading-sessions/${id}`, 'PUT', updates);
  } else {
    return store.updateReadingSession(id, updates);
  }
}

export async function deleteReadingSession(id: string): Promise<boolean> {
  if (isBrowser) {
    return await apiRequest<boolean>(`reading-sessions/${id}`, 'DELETE');
  } else {
    return store.deleteReadingSession(id);
  }
}

// Currently reading books
export async function getCurrentlyReadingBooks(): Promise<Book[]> {
  if (isBrowser) {
    return await apiRequest<Book[]>('books/currently-reading');
  } else {
    return store.getCurrentlyReadingBooks();
  }
} 
