import type { Book, ReadingSession } from './db';

// In-memory data stores
export let books: Book[] = [];
export let readingSessions: ReadingSession[] = [];

// Direct CRUD operations for server-side use
// Books
export function getAllBooks(): Book[] {
  return books;
}

export function getBookById(id: string): Book | undefined {
  return books.find(book => book.id === id);
}

export function getBookByTitleAndAuthor(title: string, author: string): Book | undefined {
  return books.find(book =>
    book.title.toLowerCase() === title.toLowerCase() &&
    book.author.toLowerCase() === author.toLowerCase()
  );
}

export function addBook(bookData: Omit<Book, 'id'>): Book {
  const newBook: Book = {
    ...bookData,
    id: crypto.randomUUID()
  };

  books.push(newBook);
  return newBook;
}

export function updateBook(id: string, updates: Partial<Omit<Book, 'id'>>): Book | undefined {
  const index = books.findIndex(book => book.id === id);
  if (index !== -1) {
    books[index] = { ...books[index], ...updates };
    return books[index];
  }
  return undefined;
}

export function deleteBook(id: string): boolean {
  const initialLength = books.length;
  books = books.filter(book => book.id !== id);
  return books.length !== initialLength;
}

// Reading sessions
export function getAllReadingSessions(): ReadingSession[] {
  return readingSessions;
}

export function getReadingSessionById(id: string): ReadingSession | undefined {
  return readingSessions.find(session => session.id === id);
}

export function getReadingSessionsForBook(bookId: string): ReadingSession[] {
  return readingSessions.filter(session => session.bookId === bookId);
}

export function addReadingSession(sessionData: Omit<ReadingSession, 'id'>): ReadingSession {
  const newSession: ReadingSession = {
    ...sessionData,
    id: crypto.randomUUID()
  };

  readingSessions.push(newSession);
  return newSession;
}

export function updateReadingSession(id: string, updates: Partial<Omit<ReadingSession, 'id'>>): ReadingSession | undefined {
  const index = readingSessions.findIndex(session => session.id === id);
  if (index !== -1) {
    readingSessions[index] = { ...readingSessions[index], ...updates };
    return readingSessions[index];
  }
  return undefined;
}

export function deleteReadingSession(id: string): boolean {
  const initialLength = readingSessions.length;
  readingSessions = readingSessions.filter(session => session.id !== id);
  return readingSessions.length !== initialLength;
}

// Currently reading books
export function getCurrentlyReadingBooks(): Book[] {
  const bookProgressMap = new Map<string, number>();

  // Calculate total pages read for each book
  readingSessions.forEach(session => {
    const current = bookProgressMap.get(session.bookId) || 0;
    bookProgressMap.set(session.bookId, current + session.pagesRead);
  });

  // Find books that have reading progress but are not finished
  return books.filter(book => {
    const pagesRead = bookProgressMap.get(book.id) || 0;
    return pagesRead > 0 && pagesRead < book.pageCount;
  });
} 
