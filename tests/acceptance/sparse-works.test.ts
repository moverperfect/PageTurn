import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteFixtures,
  request,
  signUpFixture,
  type Fixture,
} from './helpers';

interface WorkResource {
  id: string;
  title: string;
  firstPublicationDate: string | null;
  subjects: { id: string; name: string; provenance: string | null }[];
}

interface WorkListResponse {
  works: WorkResource[];
}

interface BookResponse {
  id: string;
  title: string;
}

describe('sparse Works', () => {
  let reader: Fixture;
  let otherReader: Fixture;
  const title = `Obscure Tract ${crypto.randomUUID()}`;
  const otherTitle = `Unrelated Work ${crypto.randomUUID()}`;
  let created: WorkResource;

  beforeAll(async () => {
    reader = await signUpFixture('works-reader');
    otherReader = await signUpFixture('works-other');
  });

  afterAll(() => {
    deleteFixtures([reader, otherReader]);
  });

  it('rejects catalog mutation without a session', async () => {
    const response = await request('/api/works', {
      method: 'POST',
      body: { title },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('redirects the catalog pages without a session', async () => {
    for (const path of ['/works', '/works/new']) {
      const response = await request(path);
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/login');
    }
  });

  it('rejects a Work without a title', async () => {
    const response = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title: '   ' },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Title is required' });
  });

  it('lets an authenticated Reader create a Work from only a title', async () => {
    const response = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: {
        title,
        author: 'Fabricated Author',
        format: 'Paperback',
        pageCount: 0,
        publishedYear: 0,
        genre: 'Unknown',
      },
    });
    expect(response.status).toBe(201);
    created = (await response.json()) as WorkResource;
    expect(created.id).toBeTruthy();
    expect(created.title).toBe(title);
    expect(created.firstPublicationDate).toBeNull();
    expect(created).toEqual({
      id: created.id,
      title,
      firstPublicationDate: null,
      subjects: [],
    });
  });

  it('does not create an Edition, Library Entry, Holding Period, or Reading Attempt', async () => {
    const [library, sessions, detail] = await Promise.all([
      request('/api/books', { cookie: reader.cookie }),
      request('/api/reading-sessions', { cookie: reader.cookie }),
      request(`/api/works/${created.id}`, { cookie: reader.cookie }),
    ]);
    expect(library.status).toBe(200);
    const books = (await library.json()) as BookResponse[];
    expect(books.map((book) => book.title)).not.toContain(title);

    expect(sessions.status).toBe(200);
    expect(await sessions.json()).toEqual([]);

    expect(detail.status).toBe(200);
    expect(await detail.json()).toEqual({
      id: created.id,
      title,
      firstPublicationDate: null,
      subjects: [],
    });
  });

  it('keeps unknown optional catalog facts unknown on the Work detail view', async () => {
    const response = await request(`/works/${created.id}`, {
      cookie: reader.cookie,
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(title);
    expect(html).toMatch(
      /data-field="first-publication-date"[^>]*>\s*Unknown\s*</
    );
    expect(html).toContain('This Work has no Editions yet.');
    expect(html).not.toContain('Fabricated Author');
  });

  it('lets Readers search locally stored Works and open the stable detail view', async () => {
    const other = await request('/api/works', {
      method: 'POST',
      cookie: otherReader.cookie,
      body: { title: otherTitle },
    });
    expect(other.status).toBe(201);

    const search = await request(`/api/works?q=${encodeURIComponent(title)}`, {
      cookie: otherReader.cookie,
    });
    expect(search.status).toBe(200);
    const found = (await search.json()) as WorkListResponse;
    expect(found.works.map((work) => work.id)).toContain(created.id);
    expect(found.works.map((work) => work.title)).not.toContain(otherTitle);

    const catalogPage = await request(
      `/works?q=${encodeURIComponent(title)}`,
      { cookie: reader.cookie }
    );
    expect(catalogPage.status).toBe(200);
    const html = await catalogPage.text();
    expect(html).toContain(title);
    expect(html).toContain(`/works/${created.id}`);
    expect(html).not.toContain(otherTitle);
  });

  it('matches a title substring without treating LIKE wildcards as patterns', async () => {
    const token = `Inner${crypto.randomUUID().replaceAll('-', '')}`;
    const substringTitle = `Prefix ${token} Suffix`;
    const createdSubstring = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title: substringTitle },
    });
    expect(createdSubstring.status).toBe(201);
    const work = (await createdSubstring.json()) as WorkResource;

    const substringSearch = await request(
      `/api/works?q=${encodeURIComponent(token.toLowerCase())}`,
      { cookie: otherReader.cookie }
    );
    expect(substringSearch.status).toBe(200);
    const substringFound = (await substringSearch.json()) as WorkListResponse;
    expect(substringFound.works.map((item) => item.id)).toContain(work.id);

    const percentTitle = `Percent ${crypto.randomUUID()} 100%`;
    const createdPercent = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title: percentTitle },
    });
    expect(createdPercent.status).toBe(201);
    const percentWork = (await createdPercent.json()) as WorkResource;

    const wildcardSearch = await request(
      `/api/works?q=${encodeURIComponent('%')}`,
      { cookie: otherReader.cookie }
    );
    expect(wildcardSearch.status).toBe(200);
    const wildcardFound = (await wildcardSearch.json()) as WorkListResponse;
    expect(wildcardFound.works.map((item) => item.id)).toContain(percentWork.id);
    expect(wildcardFound.works.map((item) => item.id)).not.toContain(work.id);
    expect(wildcardFound.works.map((item) => item.id)).not.toContain(created.id);
  });

  it('finds Works whose titles use non-ASCII letters regardless of query case', async () => {
    const unicodeTitle = `Éclair ${crypto.randomUUID()}`;
    const createdUnicode = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title: unicodeTitle },
    });
    expect(createdUnicode.status).toBe(201);
    const work = (await createdUnicode.json()) as WorkResource;

    const search = await request(
      `/api/works?q=${encodeURIComponent(unicodeTitle.toLowerCase())}`,
      { cookie: otherReader.cookie }
    );
    expect(search.status).toBe(200);
    const found = (await search.json()) as WorkListResponse;
    expect(found.works.map((item) => item.id)).toContain(work.id);
  });

  it('finds a Greek title when the query uses a non-final sigma', async () => {
    const greekTitle = `ΟΣ ${crypto.randomUUID()}`;
    const createdGreek = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title: greekTitle },
    });
    expect(createdGreek.status).toBe(201);
    const work = (await createdGreek.json()) as WorkResource;

    for (const query of ['Σ', 'ος']) {
      const search = await request(
        `/api/works?q=${encodeURIComponent(query)}`,
        { cookie: otherReader.cookie }
      );
      expect(search.status).toBe(200);
      const found = (await search.json()) as WorkListResponse;
      expect(found.works.map((item) => item.id)).toContain(work.id);
    }
  });

  it('returns at most 50 Works for an empty catalog query', async () => {
    const prefix = `Bound ${crypto.randomUUID()}`;
    const createdBatch = await Promise.all(
      Array.from({ length: 51 }, (_, index) =>
        request('/api/works', {
          method: 'POST',
          cookie: reader.cookie,
          body: { title: `${prefix} ${String(index).padStart(2, '0')}` },
        })
      )
    );
    expect(createdBatch.every((response) => response.status === 201)).toBe(true);

    const list = await request('/api/works', { cookie: reader.cookie });
    expect(list.status).toBe(200);
    const found = (await list.json()) as WorkListResponse;
    expect(found.works).toHaveLength(50);
    expect(found).toEqual({ works: found.works });
  });

  it('creates a Work from the catalog form without requiring other facts', async () => {
    const formTitle = `Form Tract ${crypto.randomUUID()}`;
    const response = await request('/works/new', {
      method: 'POST',
      cookie: reader.cookie,
      form: new URLSearchParams({ title: formTitle }),
    });
    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toBeTruthy();
    const detailPath = new URL(location!, 'http://acceptance.invalid').pathname;
    expect(detailPath).toMatch(/^\/works\/[0-9a-f-]{36}$/i);

    const detail = await request(detailPath, { cookie: reader.cookie });
    expect(detail.status).toBe(200);
    const html = await detail.text();
    expect(html).toContain(formTitle);
    expect(html).toMatch(
      /data-field="first-publication-date"[^>]*>\s*Unknown\s*</
    );
  });
});
