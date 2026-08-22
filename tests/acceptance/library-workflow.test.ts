import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteFixtures,
  request,
  signUpFixture,
  type Fixture,
} from './helpers';

interface BookResponse {
  id: string;
  title: string;
  author: string;
}

describe('library workflow', () => {
  let reader: Fixture;
  let otherReader: Fixture;
  const bookTitle = `Acceptance Novel ${crypto.randomUUID()}`;

  beforeAll(async () => {
    reader = await signUpFixture('reader');
    otherReader = await signUpFixture('other-reader');
  });

  afterAll(() => {
    deleteFixtures([reader, otherReader]);
  });

  it('lets a Reader add an entry to their Library', async () => {
    const response = await request('/api/books', {
      method: 'POST',
      cookie: reader.cookie,
      body: {
        title: bookTitle,
        author: 'Accepta Tester',
        format: 'Paperback',
        pageCount: 320,
        isbn: '9780000000000',
        authorSex: 'Unknown',
        recommended: false,
        genre: 'Fiction',
        publishedYear: 2020,
        publisher: 'Acceptance Press',
        dateAcquired: '2026-08-01',
        dateRemoved: null,
        cost: 9.99,
        startingPage: 0,
        finished: false,
      },
    });
    expect(response.status).toBe(201);
    const created = (await response.json()) as BookResponse;
    expect(created.id).toBeTruthy();
    expect(created.title).toBe(bookTitle);
  });

  it('lists the entry through the API for its owning Reader', async () => {
    const response = await request('/api/books', { cookie: reader.cookie });
    expect(response.status).toBe(200);
    const books = (await response.json()) as BookResponse[];
    expect(books.map((book) => book.title)).toContain(bookTitle);
  });

  it('renders the entry on the Library page', async () => {
    const response = await request('/books', { cookie: reader.cookie });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(bookTitle);
  });

  it('keeps the entry out of another Reader\'s Library', async () => {
    const response = await request('/api/books', { cookie: otherReader.cookie });
    expect(response.status).toBe(200);
    const books = (await response.json()) as BookResponse[];
    expect(books.map((book) => book.title)).not.toContain(bookTitle);
  });
});
